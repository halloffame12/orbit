import { useState, useEffect, useRef, useCallback } from "react";
import { OrbitAPI, AppConfig, InterviewMode, LLMConfig, ConnectionTest, STTTestResult, AudioDiagnostic } from "@/lib/types";

/**
 * Central hook wiring renderer state to the main process over IPC.
 * Exposes behavioral + coding copilot state and all actions.
 */
export function useCopilot() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [profile, setProfile] = useState<unknown | null>(null);
  const [transcript, setTranscript] = useState<any[]>([]);
  const [answer, setAnswer] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastQuestion, setLastQuestion] = useState("");
  const [audioStatus, setAudioStatus] = useState<string>("idle");
  const [diagnostic, setDiagnostic] = useState<AudioDiagnostic | null>(null);
  const [clickthrough, setClickthrough] = useState(false);
  const [visible, setVisible] = useState(true);
  const [speaker, setSpeaker] = useState<"Interviewer" | "Me" | null>(null);
  const [stats, setStats] = useState({ tokens: 0, lastLatency: 0 });
  const [lastError, setLastError] = useState<string | null>(null);
  const [mode, setMode] = useState<InterviewMode>("behavioral");
  const [solveStatus, setSolveStatus] = useState<string>("idle");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [interactive, setInteractive] = useState(false);

  const api = window.orbit as OrbitAPI;
  const configRef = useRef<AppConfig | null>(null);

  useEffect(() => {
    configRef.current = config;
    if (config) setMode(config.mode);
  }, [config]);

  // Load initial config + profile
  useEffect(() => {
    api.getConfig().then(setConfig);
    api.getProfile().then(setProfile);

    api.onTranscript((line) => {
      setTranscript((prev) => [...prev.slice(-24), line]);
      if (line.speaker === "Interviewer") setLastQuestion(line.text);
    });

    api.onLLMToken((chunk) => {
      setAnswer(chunk.text);
      setStats((s) => ({ tokens: chunk.text.split(" ").length, lastLatency: s.lastLatency }));
    });

    api.onLLMComplete((data) => {
      setIsStreaming(false);
      setStats((s) => ({ ...s, lastLatency: data.elapsedMs }));
    });

    api.onLLMError((err) => {
      setIsStreaming(false);
      setLastError(err);
    });

    api.onSpeakerChange((data) => setSpeaker(data.speaker));

    api.onAudioStatus((status) => setAudioStatus(status));

    api.onAudioDiagnostic((msg) => setDiagnostic(msg));

    api.onSolveStatus((status) => {
      setSolveStatus(status);
      if (status === "capturing") {
        setAnswer("");
        setIsStreaming(true);
        setLastError(null);
      }
      if (status === "error") setIsStreaming(false);
    });

    api.onForceGenerate(() => {
      setIsStreaming(true);
      setAnswer("");
      api.forceGenerate();
    });

    api.onToggleClickthrough(() => {
      setClickthrough((prev) => {
        const next = !prev;
        api.setClickthrough(next);
        return next;
      });
    });

    api.onClearContext(() => {
      setTranscript([]);
      setAnswer("");
      setLastQuestion("");
      setSolveStatus("idle");
      api.clearContext();
    });

    api.onOpenSettings(() => openSettings());

    api.startAudio().catch(() => setAudioStatus("error"));
  }, []);

  const updateConfig = useCallback((patch: Partial<AppConfig>) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch, llm: { ...prev.llm, ...(patch.llm as any) } };
      api.saveConfig(next);
      return next;
    });
  }, []);

  const setInterviewMode = useCallback((m: InterviewMode) => {
    setMode(m);
    api.setMode(m);
    api.saveConfig({ mode: m });
  }, []);

  const openSettings = useCallback(() => {
    setSettingsOpen(true);
    setInteractive(true);
    api.setInteractive(true);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    setInteractive(false);
    api.setInteractive(false);
  }, []);

  const toggleClickthrough = useCallback(() => {
    setClickthrough((prev) => {
      const next = !prev;
      api.setClickthrough(next);
      return next;
    });
  }, []);

  const forceGenerate = useCallback(() => {
    setIsStreaming(true);
    setAnswer("");
    api.forceGenerate();
  }, []);

  const captureAndSolve = useCallback(() => {
    api.captureAndSolve();
  }, []);

  const clearAll = useCallback(() => {
    setTranscript([]);
    setAnswer("");
    setLastQuestion("");
    setSolveStatus("idle");
    api.clearContext();
  }, []);

  const testConnection = useCallback(
    async (draft: Partial<LLMConfig>): Promise<ConnectionTest> => api.testConnection(draft),
    []
  );

  const testSTT = useCallback(
    async (draft: Partial<AppConfig["stt"]>): Promise<STTTestResult> => api.testSTT(draft),
    []
  );

  const quitApp = useCallback(() => {
    api.quit();
  }, []);

  const setOverlayOpacity = useCallback((opacity: number) => {
    api.setOpacity(opacity);
    updateConfig({ overlay: { ...(configRef.current?.overlay as any), opacity } });
  }, []);

  return {
    config,
    profile,
    transcript,
    answer,
    isStreaming,
    lastQuestion,
    audioStatus,
    diagnostic,
    clickthrough,
    visible,
    speaker,
    stats,
    lastError,
    mode,
    solveStatus,
    settingsOpen,
    interactive,
    updateConfig,
    setInterviewMode,
    openSettings,
    closeSettings,
    toggleClickthrough,
    forceGenerate,
    captureAndSolve,
    clearAll,
    testConnection,
    testSTT,
    quitApp,
    setOverlayOpacity,
  };
}