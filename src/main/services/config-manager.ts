import { app, safeStorage } from "electron";
import fs from "fs";
import path from "path";
import { CandidateProfile, DEFAULT_LLM_CONFIG, LLMConfig } from "./llm-service";

export type InterviewMode = "behavioral" | "coding";

export interface AppConfig {
  mode: InterviewMode;
  stt: {
    provider: "deepgram" | "local";
    apiKey: string;
    model: string;
    vadThresholdMs: number;
    whisperUrl: string;
  };
  llm: LLMConfig;
  overlay: {
    opacity: number;
    width: number;
    height: number;
    padding: number;
    fontSize: number;
    position: "top-center" | "top-right" | "bottom-right" | "bottom-left";
  };
  hotkeys: {
    toggleVisibility: string;
    toggleClickthrough: string;
    forceGenerate: string;
    snip: string;
    clearContext: string;
    openSettings: string;
    quit: string;
  };
}

const DEFAULT_CONFIG: AppConfig = {
  mode: "behavioral",
  stt: {
    provider: "local",
    apiKey: "",
    model: "nova-2-general",
    vadThresholdMs: 800,
    whisperUrl: "http://localhost:9022",
  },
  llm: { ...DEFAULT_LLM_CONFIG },
  overlay: {
    opacity: 0.95,
    width: 420,
    height: 220,
    padding: 16,
    fontSize: 26,
    position: "top-center",
  },
  hotkeys: {
    toggleVisibility: "CommandOrControl+Shift+H",
    toggleClickthrough: "CommandOrControl+Shift+C",
    forceGenerate: "CommandOrControl+Shift+Space",
    snip: "CommandOrControl+Shift+S",
    clearContext: "CommandOrControl+Shift+X",
    openSettings: "CommandOrControl+Shift+O",
    quit: "CommandOrControl+Shift+Q",
  },
};

const API_KEY_FIELDS = ["apiKey"] as const;

/**
 * ConfigManager persists settings + candidate profile to the Electron
 * userData directory. API keys are encrypted with OS safeStorage before
 * touching disk (DPAPI on Windows, Keychain on macOS).
 */
export class ConfigManager {
  private configPath: string;
  private profilePath: string;
  private config: AppConfig;
  private profile: CandidateProfile;
  private firstRun: boolean;

  constructor() {
    const userData = app.getPath("userData");
    this.configPath = path.join(userData, "config.json");
    this.profilePath = path.join(userData, "profile.json");

    this.firstRun = !fs.existsSync(this.configPath);
    this.config = this.readConfig();
    this.profile = this.loadJSON<CandidateProfile>(this.profilePath, this.emptyProfile());
  }

  /** True when no config.json existed before this launch (fresh install). */
  isFirstRun(): boolean {
    return this.firstRun;
  }

  /* ----------------------- encryption helpers ----------------------- */

  private encryptIfPossible(value: string): string | null {
    if (!value) return null;
    try {
      if (safeStorage.isEncryptionAvailable()) {
        return safeStorage.encryptString(value).toString("base64");
      }
      // No OS keychain available: store base64 (in-transit equivalent only).
      return "legacy:" + Buffer.from(value, "utf-8").toString("base64");
    } catch {
      return null;
    }
  }

  private decryptIfNeeded(value: string | undefined): string {
    if (!value) return "";
    try {
      if (value.startsWith("legacy:")) {
        return Buffer.from(value.slice(7), "base64").toString("utf-8");
      }
      return safeStorage.decryptString(Buffer.from(value, "base64"));
    } catch {
      return "";
    }
  }

  /* ---------------------------- load/save ---------------------------- */

  private deepMerge<T>(base: T, patch: any): T {
    if (Array.isArray(base)) return patch as T;
    if (typeof base === "object" && base !== null && typeof patch === "object" && patch !== null) {
      const out: any = { ...base };
      for (const key of Object.keys(patch)) {
        out[key] =
          typeof (base as any)[key] === "object" && (base as any)[key] !== null &&
          typeof patch[key] === "object" && patch[key] !== null && !Array.isArray(patch[key])
            ? this.deepMerge((base as any)[key], patch[key])
            : patch[key];
      }
      return out as T;
    }
    return (patch ?? base) as T;
  }

  private readConfig(): AppConfig {
    const disk = this.loadJSON<any>(this.configPath, null);
    if (!disk) return structuredClone(DEFAULT_CONFIG);

    const merged = this.deepMerge(structuredClone(DEFAULT_CONFIG), disk) as any;

    // Decrypt stored keys into in-memory plaintext for this session.
    if (merged.llm) {
      merged.llm.apiKey =
        merged.llm.apiKeyEnc != null ? this.decryptIfNeeded(merged.llm.apiKeyEnc) : (merged.llm.apiKey ?? "");
      delete merged.llm.apiKeyEnc;
    }
    if (merged.stt) {
      merged.stt.apiKey =
        merged.stt.apiKeyEnc != null ? this.decryptIfNeeded(merged.stt.apiKeyEnc) : (merged.stt.apiKey ?? "");
      delete merged.stt.apiKeyEnc;
    }
    return merged;
  }

  private persistConfig(): void {
    const payload = structuredClone(this.config) as any;
    if (payload.llm) {
      const enc = this.encryptIfPossible(payload.llm.apiKey ?? "");
      delete payload.llm.apiKey;
      if (enc) payload.llm.apiKeyEnc = enc;
    }
    if (payload.stt) {
      const enc = this.encryptIfPossible(payload.stt.apiKey ?? "");
      delete payload.stt.apiKey;
      if (enc) payload.stt.apiKeyEnc = enc;
    }
    this.saveJSON(this.configPath, payload);
  }

  private loadJSON<T>(filePath: string, fallback: T): T {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, "utf-8"));
      }
    } catch (err) {
      console.error(`[config] Failed to load ${filePath}:`, err);
    }
    return fallback;
  }

  private saveJSON(filePath: string, data: any): void {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.error(`[config] Failed to save ${filePath}:`, err);
    }
  }

  /* ----------------------------- public API ----------------------------- */

  getAll(): AppConfig {
    return this.config;
  }

  setAll(data: Partial<AppConfig>): void {
    this.config = this.deepMerge(this.config, data as any);
    this.persistConfig();
  }

  setMode(mode: InterviewMode): void {
    this.config.mode = mode;
    this.persistConfig();
  }

  getMode(): InterviewMode {
    return this.config.mode;
  }

  getProfile(): CandidateProfile {
    return this.profile;
  }

  setProfile(data: CandidateProfile): void {
    this.profile = data;
    this.saveJSON(this.profilePath, this.profile);
  }

  getSTTConfig() {
    return this.config.stt;
  }

  getOverlayPosition() {
    return this.config.overlay.position;
  }

  getLLMConfig(): LLMConfig {
    return this.config.llm;
  }

  updateLLMConfig(cfg: LLMConfig): void {
    this.config.llm = { ...this.config.llm, ...cfg };
    this.persistConfig();
  }

  private emptyProfile(): CandidateProfile {
    return {
      name: "",
      targetRole: "",
      resumeSummary: "",
      technicalStrengths: [],
      stories: [],
      weaknesses: "",
    };
  }
}

export { API_KEY_FIELDS };