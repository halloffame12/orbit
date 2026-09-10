export type ProviderId = "openai" | "gemini" | "claude" | "local";
export type InterviewMode = "behavioral" | "coding";
export type OverlayPosition = "top-center" | "top-right" | "bottom-right" | "bottom-left";

export interface TranscriptLine {
  speaker: "Interviewer" | "Me";
  text: string;
  timestamp: number;
}

export interface LLMChunk {
  text: string;
  delta?: string;
}

export interface LLMComplete {
  text: string;
  elapsedMs: number;
}

export interface LLMConfig {
  provider: ProviderId;
  apiKey: string;
  baseUrl: string;
  model: string;
  visionModel: string;
  maxTokens: number;
  temperature: number;
}

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
    position: OverlayPosition;
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

export const PROVIDER_META: Record<
  ProviderId,
  { label: string; defaultBaseUrl: string; defaultModel: string; defaultVisionModel: string; needsKey: boolean }
> = {
  openai: { label: "OpenAI", defaultBaseUrl: "https://api.openai.com", defaultModel: "gpt-4o-mini", defaultVisionModel: "gpt-4o-mini", needsKey: true },
  gemini: { label: "Google Gemini", defaultBaseUrl: "https://generativelanguage.googleapis.com", defaultModel: "gemini-2.5-flash", defaultVisionModel: "gemini-2.5-flash", needsKey: true },
  claude: { label: "Anthropic Claude", defaultBaseUrl: "https://api.anthropic.com", defaultModel: "claude-3-5-haiku", defaultVisionModel: "claude-3-5-haiku", needsKey: true },
  local: { label: "Local / Custom", defaultBaseUrl: "http://localhost:11434", defaultModel: "llama3.1", defaultVisionModel: "llava", needsKey: false },
};

export interface SpeakerChange {
  speaker: "Interviewer" | "Me";
  frames: number;
  time: number;
}

export interface ConnectionTest {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export type STTTestResult = ConnectionTest;

export interface AudioDiagnostic {
  level: "ok" | "warn" | "error";
  message: string;
}

// Global bridge type — exposed via preload
export interface OrbitAPI {
  getConfig(): Promise<AppConfig>;
  saveConfig(data: Partial<AppConfig>): Promise<boolean>;
  getProfile(): Promise<unknown>;
  saveProfile(data: unknown): Promise<boolean>;
  setOpacity(opacity: number): Promise<void>;
  setClickthrough(enabled: boolean): Promise<void>;
  setInteractive(enabled: boolean): Promise<void>;
  setMode(mode: InterviewMode): Promise<void>;
  forceGenerate(): Promise<void>;
  clearContext(): Promise<void>;
  captureAndSolve(): Promise<void>;
  testConnection(cfg: Partial<LLMConfig>): Promise<ConnectionTest>;
  testSTT(cfg: Partial<AppConfig["stt"]>): Promise<STTTestResult>;
  startAudio(): Promise<void>;
  stopAudio(): Promise<void>;
  getDevices(): Promise<unknown[]>;
  quit(): void;
  onTranscript(cb: (data: TranscriptLine) => void): void;
  onLLMToken(cb: (data: LLMChunk) => void): void;
  onLLMComplete(cb: (data: LLMComplete) => void): void;
  onLLMError(cb: (err: string) => void): void;
  onSpeakerChange(cb: (data: SpeakerChange) => void): void;
  onAudioStatus(cb: (status: string) => void): void;
  onAudioDiagnostic(cb: (msg: AudioDiagnostic) => void): void;
  onSolveStatus(cb: (status: string) => void): void;
  onForceGenerate(cb: () => void): void;
  onToggleClickthrough(cb: () => void): void;
  onClearContext(cb: () => void): void;
  onOpenSettings(cb: () => void): void;
}

declare global {
  interface Window {
    orbit: OrbitAPI;
  }
}