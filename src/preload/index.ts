import { contextBridge, ipcRenderer } from "electron";

// TypeScript declarations for window.orbit
export interface OrbitAPI {
  getConfig(): Promise<any>;
  saveConfig(data: any): Promise<boolean>;
  getProfile(): Promise<any>;
  saveProfile(data: any): Promise<boolean>;
  setOpacity(opacity: number): Promise<void>;
  setClickthrough(enabled: boolean): Promise<void>;
  setInteractive(enabled: boolean): Promise<void>;
  setMode(mode: "behavioral" | "coding"): Promise<void>;
  forceGenerate(): Promise<void>;
  clearContext(): Promise<void>;
  captureAndSolve(): Promise<void>;
  testConnection(cfg: any): Promise<{ ok: boolean; latencyMs: number; error?: string }>;
  startAudio(): Promise<void>;
  stopAudio(): Promise<void>;
  getDevices(): Promise<any[]>;
  quit(): void;
  onTranscript(cb: (data: any) => void): void;
  onLLMToken(cb: (data: any) => void): void;
  onLLMComplete(cb: (data: any) => void): void;
  onLLMError(cb: (err: string) => void): void;
  onSpeakerChange(cb: (data: any) => void): void;
  onAudioStatus(cb: (status: string) => void): void;
  onSolveStatus(cb: (status: string) => void): void;
  onForceGenerate(cb: () => void): void;
  onToggleClickthrough(cb: () => void): void;
  onClearContext(cb: () => void): void;
  onOpenSettings(cb: () => void): void;
}

const api: OrbitAPI = {
  getConfig: () => ipcRenderer.invoke("ipc:get-config"),
  saveConfig: (data) => ipcRenderer.invoke("ipc:save-config", data),
  getProfile: () => ipcRenderer.invoke("ipc:get-profile"),
  saveProfile: (data) => ipcRenderer.invoke("ipc:save-profile", data),
  setOpacity: (opacity) => ipcRenderer.invoke("ipc:set-opacity", opacity),
  setClickthrough: (enabled) => ipcRenderer.invoke("ipc:set-clickthrough", enabled),
  setInteractive: (enabled) => ipcRenderer.invoke("ipc:set-interactive", enabled),
  setMode: (mode) => ipcRenderer.invoke("ipc:set-mode", mode),
  forceGenerate: () => ipcRenderer.invoke("ipc:force-generate"),
  clearContext: () => ipcRenderer.invoke("ipc:clear-context"),
  captureAndSolve: () => ipcRenderer.invoke("ipc:capture-and-solve"),
  testConnection: (cfg) => ipcRenderer.invoke("ipc:test-connection", cfg),
  startAudio: () => ipcRenderer.invoke("ipc:start-audio"),
  stopAudio: () => ipcRenderer.invoke("ipc:stop-audio"),
  getDevices: () => ipcRenderer.invoke("ipc:get-devices"),
  quit: () => ipcRenderer.send("ipc:quit"),
  onTranscript: (cb) => {
    ipcRenderer.on("ipc:transcript", (_e, data) => cb(data));
  },
  onLLMToken: (cb) => {
    ipcRenderer.on("ipc:llm-token", (_e, data) => cb(data));
  },
  onLLMComplete: (cb) => {
    ipcRenderer.on("ipc:llm-complete", (_e, data) => cb(data));
  },
  onLLMError: (cb) => {
    ipcRenderer.on("ipc:llm-error", (_e, err) => cb(err));
  },
  onSpeakerChange: (cb) => {
    ipcRenderer.on("ipc:speaker-change", (_e, data) => cb(data));
  },
  onAudioStatus: (cb) => {
    ipcRenderer.on("ipc:audio-status", (_e, status) => cb(status));
  },
  onSolveStatus: (cb) => {
    ipcRenderer.on("ipc:solve-status", (_e, status) => cb(status));
  },
  onForceGenerate: (cb) => {
    ipcRenderer.on("ipc:force-generate", () => cb());
  },
  onToggleClickthrough: (cb) => {
    ipcRenderer.on("ipc:toggle-clickthrough", () => cb());
  },
  onClearContext: (cb) => {
    ipcRenderer.on("ipc:clear-context", () => cb());
  },
  onOpenSettings: (cb) => {
    ipcRenderer.on("ipc:open-settings", () => cb());
  },
};

contextBridge.exposeInMainWorld("orbit", api);