import React from "react";
import { useCopilot } from "@/hooks/useCopilot";
import { Teleprompter } from "@/components/Teleprompter";
import { SettingsModal } from "@/components/SettingsModal";

/**
 * Root overlay app.
 * The entire window is excluded from DWM capture (WDA_EXCLUDEFROMCAPTURE),
 * so the teleprompter, HUD and settings can never appear in a screen share.
 */
export default function App() {
  const {
    answer,
    isStreaming,
    audioStatus,
    diagnostic,
    config,
    stats,
    lastError,
    mode,
    solveStatus,
    settingsOpen,
    updateConfig,
    setInterviewMode,
    openSettings,
    closeSettings,
    testConnection,
    testSTT,
    setOverlayOpacity,
    captureAndSolve,
    forceGenerate,
    clearAll,
    clickthrough,
    toggleClickthrough,
    quitApp,
  } = useCopilot();

  if (!config) return null;

  return (
    <div
      className="w-screen h-screen select-none"
      style={{
        background: "rgba(8, 8, 10, 0.72)",
        backdropFilter: "blur(3px)",
        borderRadius: 16,
        border: isStreaming
          ? "1px solid rgba(0, 229, 160, 0.35)"
          : "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.45)",
      }}
    >
      {settingsOpen && config ? (
        <SettingsModal
          config={config}
          onSave={updateConfig}
          onSetMode={setInterviewMode}
          onClose={closeSettings}
          onTestConnection={testConnection}
          onTestSTT={testSTT}
          audioStatus={audioStatus}
          diagnostic={diagnostic}
        />
      ) : (
        <>
          <div className="absolute inset-0 px-4 py-3">
            <Teleprompter
              answer={answer}
              isStreaming={isStreaming}
              mode={mode}
              solveStatus={solveStatus}
              fontSize={config.overlay.fontSize}
              padding={config.overlay.padding}
            />
          </div>

          {/* Top-right HUD */}
          <div className="absolute top-2 right-3 flex flex-col items-end gap-1 text-[10px] font-mono text-copilot-muted">
            <div className="flex items-center gap-2">
              {/* Mode chip */}
              <button
                onClick={() => setInterviewMode(mode === "behavioral" ? "coding" : "behavioral")}
                className={`px-1.5 py-0.5 rounded border text-[9px] uppercase tracking-widest ${
                  mode === "coding"
                    ? "border-copilot-accent/50 text-copilot-accent"
                    : "border-white/10 text-copilot-dim"
                }`}
                title="Toggle Behavioral / Coding mode"
              >
                {mode === "coding" ? "Code" : "Talk"}
              </button>

              {/* Snip */}
              <button
                onClick={captureAndSolve}
                className="px-1.5 py-0.5 rounded border border-white/10 text-copilot-dim hover:text-copilot-accent hover:border-copilot-accent/40"
                title="Capture & solve (Ctrl+Shift+S)"
              >
                ✂
              </button>

              {/* Force generate */}
              <button
                onClick={forceGenerate}
                className="px-1.5 py-0.5 rounded border border-white/10 text-copilot-dim hover:text-copilot-accent hover:border-copilot-accent/40"
                title="Force generate (Ctrl+Shift+Space)"
              >
                ▶
              </button>

              {/* Settings */}
              <button
                onClick={openSettings}
                className="px-1.5 py-0.5 rounded border border-white/10 text-copilot-dim hover:text-copilot-accent hover:border-copilot-accent/40"
                title="Settings (Ctrl+Shift+O)"
              >
                ⚙
              </button>

              {/* Click-through toggle */}
              <button
                onClick={toggleClickthrough}
                className={`px-1.5 py-0.5 rounded border ${
                  clickthrough ? "border-copilot-accent/50 text-copilot-accent" : "border-white/10 text-copilot-dim"
                }`}
                title="Toggle click-through (Ctrl+Shift+C)"
              >
                ◈
              </button>

              {/* Clear */}
              <button
                onClick={clearAll}
                className="px-1.5 py-0.5 rounded border border-white/10 text-copilot-dim hover:text-red-400 hover:border-red-400/40"
                title="Clear context (Ctrl+Shift+X)"
              >
                ✕
              </button>

              {/* Quit */}
              <button
                onClick={quitApp}
                className="px-1.5 py-0.5 rounded border border-white/10 text-copilot-dim hover:text-red-400 hover:border-red-400/60"
                title="Quit Orbit (Ctrl+Shift+Q)"
              >
                ⏻
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <StatusDot status={audioStatus} />
              <span>{audioStatus}</span>
            </div>
            {diagnostic && (
              <span
                className={`max-w-[210px] text-right leading-tight ${
                  diagnostic.level === "error"
                    ? "text-red-400"
                    : diagnostic.level === "warn"
                      ? "text-amber-300"
                      : "text-copilot-accent"
                }`}
                title={diagnostic.message}
              >
                {diagnostic.message}
              </span>
            )}
            {stats.lastLatency > 0 && (
              <span>
                {stats.lastLatency}ms · {stats.tokens} tok
              </span>
            )}
            {solveStatus === "solving" && <span className="text-copilot-accent">solving…</span>}
            {lastError && (
              <span className="text-red-400 max-w-[200px] truncate">{lastError}</span>
            )}
          </div>

          {/* Opacity control */}
          <div className="absolute bottom-2 right-2 opacity-40">
            <input
              type="range"
              min={0.4}
              max={1}
              step={0.05}
              defaultValue={config.overlay.opacity}
              onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
              aria-label="Overlay opacity"
              className="w-16 h-3"
            />
          </div>
        </>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "running" ? "#00E5A0" : status === "degraded" ? "#FBBF24" : status === "error" ? "#F87171" : "#6B7280";
  return (
    <span className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
  );
}