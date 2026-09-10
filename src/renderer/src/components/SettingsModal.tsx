import React, { useEffect, useState } from "react";
import { AppConfig, InterviewMode, LLMConfig, PROVIDER_META, ProviderId, ConnectionTest, OverlayPosition, STTTestResult, AudioDiagnostic } from "@/lib/types";

interface Props {
  config: AppConfig;
  onSave: (patch: Partial<AppConfig>) => void;
  onSetMode: (mode: InterviewMode) => void;
  onClose: () => void;
  onTestConnection: (cfg: Partial<LLMConfig>) => Promise<ConnectionTest>;
  onTestSTT: (cfg: Partial<AppConfig["stt"]>) => Promise<STTTestResult>;
  audioStatus: string;
  diagnostic: AudioDiagnostic | null;
}

const FIELD =
  "w-full bg-black/30 border border-white/10 rounded-md px-2.5 py-1.5 text-[12px] text-copilot-text font-mono outline-none focus:border-copilot-accent/60 transition-colors";
const LABEL = "block text-[10px] uppercase tracking-widest text-copilot-muted mb-1";

export function SettingsModal({ config, onSave, onSetMode, onClose, onTestConnection, onTestSTT, audioStatus, diagnostic }: Props) {
  const [mode, setModeLocal] = useState<InterviewMode>(config.mode);
  const [llm, setLlm] = useState<LLMConfig>({ ...config.llm });
  const [sttProvider, setSttProvider] = useState(config.stt.provider);
  const [sttKey, setSttKey] = useState(config.stt.apiKey);
  const [whisperUrl, setWhisperUrl] = useState(config.stt.whisperUrl);
  const [sttModel, setSttModel] = useState(config.stt.model);
  const [testing, setTesting] = useState<null | "running" | ConnectionTest>(null);

  const [placement, setPlacement] = useState<OverlayPosition>(config.overlay.position);
  const [sttTesting, setSttTesting] = useState<null | "running" | STTTestResult>(null);

  useEffect(() => {
    setModeLocal(config.mode);
  }, [config.mode]);

  const switchProvider = (pid: ProviderId) => {
    const meta = PROVIDER_META[pid];
    setLlm((prev) => ({
      ...prev,
      provider: pid,
      baseUrl: prev.provider !== pid ? meta.defaultBaseUrl : prev.baseUrl,
      model: meta.defaultModel,
      visionModel: meta.defaultVisionModel,
      apiKey: prev.provider !== pid ? "" : prev.apiKey,
    }));
  };

  const save = () => {
    const patch: Partial<AppConfig> = {
      mode,
      llm,
      overlay: { ...config.overlay, position: placement },
      stt: { ...config.stt, provider: sttProvider, apiKey: sttKey, whisperUrl, model: sttModel },
    };
    if (mode !== config.mode) onSetMode(mode);
    onSave(patch);
    onClose();
  };

  const test = async () => {
    setTesting("running");
    const result = await onTestConnection(llm);
    setTesting(result);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#0c0c0e]/95 backdrop-blur rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-copilot-accent" />
          <span className="text-copilot-text text-[13px] font-semibold tracking-wide">Orbit Settings</span>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-md hover:bg-white/10 text-copilot-dim grid place-items-center"
          title="Close (Ctrl+Shift+O)"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Mode */}
        <section>
          <span className={LABEL}>Interview mode</span>
          <div className="grid grid-cols-2 gap-2">
            {(["behavioral", "coding"] as InterviewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setModeLocal(m)}
                className={`rounded-md py-2 text-[12px] font-medium border transition-colors ${
                  mode === m
                    ? "border-copilot-accent bg-copilot-accent/10 text-copilot-accent"
                    : "border-white/10 text-copilot-dim hover:border-white/25"
                }`}
              >
                {m === "behavioral" ? "Behavioral / Mock" : "Live Coding"}
              </button>
            ))}
          </div>
        </section>

        {/* LLM provider */}
        <section>
          <span className={LABEL}>Language model provider</span>
          <select
            className={FIELD}
            value={llm.provider}
            onChange={(e) => switchProvider(e.target.value as ProviderId)}
          >
            {Object.entries(PROVIDER_META).map(([id, meta]) => (
              <option key={id} value={id}>
                {meta.label}
              </option>
            ))}
          </select>

          <div className="mt-2 space-y-2">
            <div>
              <span className={LABEL}>API key {PROVIDER_META[llm.provider].needsKey ? "(required)" : "(encrypted)"}</span>
              <input
                type="password"
                className={FIELD}
                placeholder={PROVIDER_META[llm.provider].needsKey ? "sk-…" : "optional"}
                value={llm.apiKey}
                onChange={(e) => setLlm({ ...llm, apiKey: e.target.value })}
              />
            </div>
            <div>
              <span className={LABEL}>Base URL</span>
              <input
                className={FIELD}
                value={llm.baseUrl}
                onChange={(e) => setLlm({ ...llm, baseUrl: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className={LABEL}>Chat model</span>
                <input
                  className={FIELD}
                  value={llm.model}
                  onChange={(e) => setLlm({ ...llm, model: e.target.value })}
                />
              </div>
              <div>
                <span className={LABEL}>Vision model</span>
                <input
                  className={FIELD}
                  value={llm.visionModel}
                  onChange={(e) => setLlm({ ...llm, visionModel: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className={LABEL}>Max tokens</span>
                <input
                  type="number"
                  className={FIELD}
                  value={llm.maxTokens}
                  onChange={(e) => setLlm({ ...llm, maxTokens: Number(e.target.value) })}
                />
              </div>
              <div>
                <span className={LABEL}>Temperature</span>
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  max={2}
                  className={FIELD}
                  value={llm.temperature}
                  onChange={(e) => setLlm({ ...llm, temperature: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>

          {/* Connection test */}
          <button
            onClick={test}
            disabled={testing === "running"}
            className="mt-3 w-full rounded-md py-2 text-[12px] font-semibold border border-copilot-accent/50 text-copilot-accent hover:bg-copilot-accent/10 disabled:opacity-50 transition-colors"
          >
            {testing === "running" ? "Testing…" : "Test Connection"}
          </button>
          {testing && testing !== "running" && (
            <div
              className={`mt-2 text-[11px] font-mono px-3 py-2 rounded-md border ${
                testing.ok
                  ? "border-copilot-accent/40 text-copilot-accent"
                  : "border-red-500/40 text-red-400"
              }`}
            >
              {testing.ok
                ? `✓ Connected in ${testing.latencyMs}ms`
                : `✕ ${testing.error ?? "Connection failed"}`}
            </div>
          )}
        </section>

        {/* STT */}
        <section>
          <span className={LABEL}>Speech-to-text (behavioral mode)</span>
          <select className={FIELD} value={sttProvider} onChange={(e) => setSttProvider(e.target.value as any)}>
            <option value="local">Local (whisper.cpp) — free</option>
            <option value="deepgram">Deepgram (API key)</option>
          </select>
          <div className="mt-2 space-y-2">
            {sttProvider === "deepgram" ? (
              <>
                <div>
                  <span className={LABEL}>Deepgram API key</span>
                  <input type="password" className={FIELD} value={sttKey} onChange={(e) => setSttKey(e.target.value)} />
                </div>
                <div>
                  <span className={LABEL}>Model</span>
                  <input className={FIELD} value={sttModel} onChange={(e) => setSttModel(e.target.value)} />
                </div>
                <div className="rounded-md border border-copilot-accent/20 bg-copilot-accent/5 px-3 py-2 text-[11px] leading-relaxed text-copilot-dim">
                  Streaming transcription via the Deepgram API. Free tier covers
                  a few hundred minutes — enough for mock interviews. Without a
                  key here, <span className="text-copilot-text">no words will ever appear</span>.
                </div>
              </>
            ) : (
              <>
                <div>
                  <span className={LABEL}>whisper.cpp server</span>
                  <input className={FIELD} value={whisperUrl} onChange={(e) => setWhisperUrl(e.target.value)} />
                </div>
                <div className="rounded-md border border-copilot-accent/20 bg-copilot-accent/5 px-3 py-2 text-[11px] leading-relaxed text-copilot-dim">
                  Runs entirely on your machine — free and private. You must have
                  a whisper.cpp HTTP server listening at the URL above. Start one:
                  <div className="mt-1 font-mono text-[10px] text-copilot-text bg-black/40 border border-white/5 rounded px-2 py-1">
                    whisper-cli --server --port 9022 --model ggml-base.en.bin
                  </div>
                  If no server is running here, <span className="text-copilot-text">nothing will be transcribed</span>.
                </div>
              </>
            )}
          </div>

          <button
            onClick={async () => {
              setSttTesting("running");
              const res = await onTestSTT({ provider: sttProvider, apiKey: sttKey, whisperUrl, model: sttModel });
              setSttTesting(res);
            }}
            disabled={sttTesting === "running"}
            className="mt-3 w-full rounded-md py-2 text-[12px] font-semibold border border-copilot-accent/50 text-copilot-accent hover:bg-copilot-accent/10 disabled:opacity-50 transition-colors"
          >
            {sttTesting === "running" ? "Checking…" : "Check speech-to-text"}
          </button>
          {sttTesting && sttTesting !== "running" && (
            <div
              className={`mt-2 whitespace-pre-wrap text-[11px] font-mono px-3 py-2 rounded-md border ${
                sttTesting.ok
                  ? "border-copilot-accent/40 text-copilot-accent"
                  : "border-red-500/40 text-red-400"
              }`}
            >
              {sttTesting.ok ? `✓ Connected in ${sttTesting.latencyMs}ms` : `✕ ${sttTesting.error ?? "Not reachable"}`}
            </div>
          )}
          {diagnostic && (
            <div
              className={`mt-2 text-[11px] px-3 py-2 rounded-md border ${
                diagnostic.level === "error"
                  ? "border-red-500/40 text-red-400"
                  : diagnostic.level === "warn"
                    ? "border-amber-400/40 text-amber-300"
                    : "border-copilot-accent/40 text-copilot-accent"
              }`}
            >
              Live: {diagnostic.message}
            </div>
          )}
        </section>
        {/* Overlay placement */}
        <section>
          <span className={LABEL}>Overlay placement</span>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["top-center", "Top · Center"],
                ["top-right", "Top · Right"],
                ["bottom-right", "Bottom · Right"],
                ["bottom-left", "Bottom · Left"],
              ] as [OverlayPosition, string][]
            ).map(([pos, label]) => (
              <button
                key={pos}
                onClick={() => setPlacement(pos)}
                className={`rounded-md py-2 text-[12px] font-medium border transition-colors ${
                  placement === pos
                    ? "border-copilot-accent bg-copilot-accent/10 text-copilot-accent"
                    : "border-white/10 text-copilot-dim hover:border-white/25"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-2 rounded-md border border-copilot-accent/20 bg-copilot-accent/5 px-3 py-2 text-[11px] leading-relaxed text-copilot-dim">
            <span className="text-copilot-accent font-semibold">Share-safe tip:</span> during a
            full-screen share the overlay area renders as solid black (it can never be seen).
            Park it over your <span className="text-copilot-text">own camera tile</span> or an
            empty corner so shared content stays fully visible — bottom-right is the video tile
            in most meeting apps. Sharing a single window hides the overlay entirely.
          </div>
        </section>

        {/* Shortcuts */}
        <section>
          <span className={LABEL}>Keyboard shortcuts</span>
          <div className="rounded-md border border-white/10 bg-black/20 divide-y divide-white/5">
            {[
              ["Show / hide overlay", config.hotkeys.toggleVisibility],
              ["Force generate", config.hotkeys.forceGenerate],
              ["Capture & solve", config.hotkeys.snip],
              ["Toggle click-through", config.hotkeys.toggleClickthrough],
              ["Clear context", config.hotkeys.clearContext],
              ["Open this settings panel", config.hotkeys.openSettings],
              ["Quit Orbit", config.hotkeys.quit],
            ].map(([label, hotkey]) => (
              <div key={hotkey} className="flex items-center justify-between px-3 py-1.5">
                <span className="text-[11px] text-copilot-dim">{label}</span>
                <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-copilot-accent">
                  {hotkey.split("+").join(" + ").replace("CommandOrControl", "Ctrl")}
                </kbd>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="flex gap-2 px-4 py-3 border-t border-white/5">
        <button
          onClick={save}
          className="flex-1 rounded-md py-2 text-[13px] font-semibold bg-copilot-accent text-black hover:brightness-110 transition-all"
        >
          Save
        </button>
        <button
          onClick={onClose}
          className="px-4 rounded-md py-2 text-[13px] text-copilot-dim border border-white/10 hover:bg-white/5"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}