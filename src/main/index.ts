import { app, BrowserWindow, globalShortcut, ipcMain, screen, Tray, Menu, nativeImage } from "electron";
import path from "path";
import { applyScreenHiding } from "./native/screen-hide";
import { AudioCaptureService } from "./services/audio-capture";
import { STTService } from "./services/stt-service";
import { LLMStreamingService, LLMConfig } from "./services/llm-service";
import { ConfigManager, InterviewMode } from "./services/config-manager";
import { CaptureService } from "./services/capture-service";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let audioService: AudioCaptureService | null = null;
let sttService: STTService | null = null;
let llmService: LLMStreamingService | null = null;
let captureService: CaptureService | null = null;
let config: ConfigManager;

const isDev = !app.isPackaged;
const OVERLAY_W = 420;
const OVERLAY_H = 220;
const SETTINGS_H = 640;

function centerX(): number {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  return Math.round(width / 2 - OVERLAY_W / 2);
}

function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: OVERLAY_W,
    height: OVERLAY_H,
    x: centerX(),
    y: 40,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload", "index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (process.platform === "darwin") {
    mainWindow.setSimpleFullScreen(true);
  }

  const applied = applyScreenHiding(mainWindow);
  console.log(`[main] Screen hiding applied: ${applied}`);

  const devUrl = "http://localhost:5173";

  if (isDev) {
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.on("did-fail-load", (_e, _code, desc, validatedUrl) => {
      if (validatedUrl.startsWith(devUrl)) {
        console.warn(`[main] Dev server unreachable (${desc}), using built renderer`);
        mainWindow?.loadFile(path.join(__dirname, "../renderer/index.html"));
      }
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  if (isDev) {
    mainWindow.webContents.on("console-message", (_e, _level, message) => {
      console.log(`[renderer] ${message}`);
    });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (isDev) {
    mainWindow.webContents.on("console-message", (_e, _level, message) => {
      console.log(`[renderer] ${message}`);
    });
  }

  return mainWindow;
}

/**
 * Fresh installs open the Settings modal on first launch so the app is
 * immediately visible and configured — instead of a barely-perceptible
 * dark overlay bar with no taskbar entry.
 */
function maybeOpenFirstRunSettings(): void {
  if (!config.isFirstRun() || !mainWindow) return;
  console.log("[main] First run detected — opening Settings");
  mainWindow.webContents.once("did-finish-load", () => {
    setTimeout(() => mainWindow?.webContents.send("ipc:open-settings"), 300);
  });
}

function createTray(): void {
  const icon = nativeImage.createFromPath(process.execPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show/Hide Copilot",
      click: () => toggleVisibility(),
    },
    {
      label: "Force Generate",
      click: () => mainWindow?.webContents.send("ipc:force-generate"),
    },
    {
      label: "Capture & Solve (Coding)",
      click: () => captureAndSolve(),
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => app.quit(),
    },
  ]);

  tray.setToolTip("Orbit Copilot");
  tray.setContextMenu(contextMenu);
  tray.on("click", () => toggleVisibility());
}

/* ----------------------------- hotkeys ----------------------------- */

function registerHotkeys(): void {
  const hotkeys = config.getAll().hotkeys;

  globalShortcut.register(hotkeys.toggleVisibility, () => toggleVisibility());
  globalShortcut.register(hotkeys.toggleClickthrough, () => {
    mainWindow?.webContents.send("ipc:toggle-clickthrough");
  });
  globalShortcut.register(hotkeys.forceGenerate, () => {
    mainWindow?.webContents.send("ipc:force-generate");
  });
  globalShortcut.register(hotkeys.snip, () => captureAndSolve());
  globalShortcut.register(hotkeys.clearContext, () => {
    mainWindow?.webContents.send("ipc:clear-context");
  });
  globalShortcut.register(hotkeys.openSettings, () => {
    mainWindow?.webContents.send("ipc:open-settings");
  });
  globalShortcut.register(hotkeys.quit, () => app.quit());
}

function toggleVisibility(): void {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.showInactive();
  }
}

/* ------------------------- interactive mode ------------------------- */

function setInteractive(enabled: boolean): void {
  if (!mainWindow) return;
  mainWindow.setFocusable(enabled);
  mainWindow.setIgnoreMouseEvents(!enabled);
  if (enabled) {
    mainWindow.setSize(OVERLAY_W, SETTINGS_H, false);
    mainWindow.setPosition(centerX(), Math.max(40, Math.round((screen.getPrimaryDisplay().workAreaSize.height - SETTINGS_H) / 2)));
    mainWindow.showInactive();
    mainWindow.focus();
  } else {
    mainWindow.setSize(OVERLAY_W, OVERLAY_H, false);
    mainWindow.setPosition(centerX(), 40);
  }
}

/* ------------------------- solve pipeline -------------------------- */

async function captureAndSolve(): Promise<void> {
  const win = mainWindow;
  win?.webContents.send("ipc:solve-status", "capturing");

  try {
    const capture = await captureService!.captureDisplay();

    // Briefly confirm the capture landed (still invisible to shares)
    console.log(`[solve] captured ${capture.width}x${capture.height}, ${(capture.png.length / 1024).toFixed(0)}KB`);

    win?.webContents.send("ipc:solve-status", "solving");
    llmService?.solveScreenshot(capture.png);
  } catch (err: any) {
    console.error("[solve] Capture failed:", err);
    win?.webContents.send("ipc:solve-status", "error");
    win?.webContents.send("ipc:llm-error", `Capture failed: ${err?.message ?? err}`);
  }
}

/* ----------------------------- IPC -------------------------------- */

function setupIPC(): void {
  ipcMain.handle("ipc:get-config", () => config.getAll());

  ipcMain.handle("ipc:save-config", (_e, data) => {
    config.setAll(data);
    llmService?.updateConfig(data.llm ? { ...config.getLLMConfig() } : config.getLLMConfig());
    registerHotkeys(); // hotkey changes take effect immediately
    return true;
  });

  ipcMain.handle("ipc:get-profile", () => config.getProfile());

  ipcMain.handle("ipc:save-profile", (_e, data) => {
    config.setProfile(data);
    return true;
  });

  ipcMain.handle("ipc:set-opacity", (_e, opacity: number) => {
    mainWindow?.setOpacity(opacity);
  });

  ipcMain.handle("ipc:set-clickthrough", (_e, enabled: boolean) => {
    mainWindow?.setIgnoreMouseEvents(enabled);
  });

  ipcMain.handle("ipc:set-interactive", (_e, enabled: boolean) => {
    setInteractive(enabled);
  });

  ipcMain.handle("ipc:set-mode", (_e, mode: InterviewMode) => {
    config.setMode(mode);
  });

  ipcMain.handle("ipc:force-generate", () => {
    if (sttService && llmService) {
      const transcript = sttService.getTranscript();
      llmService.generateFromTranscript(transcript, config.getProfile());
    }
  });

  ipcMain.handle("ipc:clear-context", () => {
    sttService?.clearTranscript();
    llmService?.abort();
    mainWindow?.webContents.send("ipc:context-cleared");
  });

  ipcMain.handle("ipc:capture-and-solve", () => captureAndSolve());

  ipcMain.on("ipc:quit", () => app.quit());

  ipcMain.handle("ipc:test-connection", (_e, draftCfg: Partial<LLMConfig>) => {
    return llmService?.testConnection({ ...config.getLLMConfig(), ...draftCfg }) ?? { ok: false, latencyMs: 0, error: "LLM service not ready" };
  });

  ipcMain.handle("ipc:start-audio", async () => {
    await startAudioPipeline();
  });

  ipcMain.handle("ipc:stop-audio", async () => {
    await stopAudioPipeline();
  });

  ipcMain.handle("ipc:get-devices", async () => {
    return audioService?.getDevices() ?? [];
  });
}

/* ------------------------ audio pipeline --------------------------- */

async function startAudioPipeline(): Promise<void> {
  try {
    audioService = new AudioCaptureService();
    sttService = new STTService(config.getSTTConfig());

    audioService.on("audio", (chunk) => {
      sttService?.sendAudio(chunk);
    });

    sttService.on("transcript", (data) => {
      mainWindow?.webContents.send("ipc:transcript", data);
    });

    sttService.on("speaker-change", (data) => {
      mainWindow?.webContents.send("ipc:speaker-change", data);
    });

    sttService.on("interviewer-question", (question: string) => {
      // Behavioral round: auto-generate bullets. Coding round: the
      // interviewer is explaining the problem — stay quiet (use snip).
      if (config.getMode() === "coding") return;

      const profile = config.getProfile();
      const history = sttService!.getTranscript();
      llmService?.generateResponse(question, history, profile);
    });

    await audioService.start();
    await sttService.connect();

    mainWindow?.webContents.send("ipc:audio-status", "running");
  } catch (err: any) {
    console.error("[main] Audio pipeline error:", err);
    mainWindow?.webContents.send("ipc:audio-status", "error");
  }
}

async function stopAudioPipeline(): Promise<void> {
  await audioService?.stop();
  await sttService?.disconnect();
  llmService?.abort();
  mainWindow?.webContents.send("ipc:audio-status", "stopped");
}

/* --------------------------- lifecycle ----------------------------- */

app.whenReady().then(async () => {
  config = new ConfigManager();
  llmService = new LLMStreamingService(config.getLLMConfig());
  captureService = new CaptureService();

  createWindow();
  createTray();
  registerHotkeys();
  setupIPC();
  maybeOpenFirstRunSettings();
});

app.on("window-all-closed", () => {
  globalShortcut.unregisterAll();
  app.quit();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  audioService?.stop();
  sttService?.disconnect();
});