import { EventEmitter } from "events";
import { spawn, ChildProcess } from "child_process";

export interface AudioDevice {
  id: string;
  name: string;
  type: "microphone" | "loopback";
}

export interface AudioDiagnostic {
  level: "ok" | "warn" | "error";
  message: string;
}

/**
 * AudioCaptureService captures two channels:
 * 1. Microphone input (candidate's voice → tagged as [Me])
 * 2. System audio loopback (interviewer via meeting app → tagged as [Interviewer])
 *
 * On Windows, uses a bundled WASAPI capture script or native addon.
 * Uses raw PCM chunks (16kHz, mono, 16-bit) for STT compatibility.
 */
export class AudioCaptureService extends EventEmitter {
  private micProcess: ChildProcess | null = null;
  private loopbackProcess: ChildProcess | null = null;
  private running = false;
  private sampleRate = 16000;
  private channels = 1;

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    const ffmpegPath = this.findFfmpeg();

    if (process.platform === "win32") {
      await this.startWindowsCapture(ffmpegPath);
    } else {
      await this.startMacCapture(ffmpegPath);
    }
  }

  private async startWindowsCapture(ffmpegPath: string): Promise<void> {
    // Microphone capture via dshow (DirectShow)
    const micDevice = await this.getDefaultMicDevice();
    if (micDevice) {
      this.micProcess = spawn(
        ffmpegPath,
        [
          "-f", "dshow",
          "-i", `audio=${micDevice}`,
          "-ar", String(this.sampleRate),
          "-ac", String(this.channels),
          "-f", "s16le",
          "-acodec", "pcm_s16le",
          "-block_size", "3200", // 100ms chunks at 16kHz
          "pipe:1",
        ],
        { stdio: ["ignore", "pipe", "pipe"] }
      );

      this.micProcess.stdout?.on("data", (chunk: Buffer) => {
        this.emit("audio", { source: "mic", data: chunk });
      });

      this.micProcess.stderr?.on("data", (data: Buffer) => {
        // ffmpeg logs to stderr — ignore unless debugging
        if (process.env.DEBUG_AUDIO) {
          console.log("[audio:mic]", data.toString());
        }
      });

      this.micProcess.on("error", (err: NodeJS.ErrnoException) => {
        console.error("[audio:mic] process error:", err);
        if (err.code === "ENOENT") {
          this.emit("diagnostic", {
            level: "error",
            message: "ffmpeg was not found on PATH — audio capture is impossible. Install it with: winget install Gyan.FFmpeg, then restart Orbit.",
          });
        } else {
          this.emit("diagnostic", { level: "error", message: `Microphone capture failed: ${err.message}` });
        }
        this.emit("error", { source: "mic", error: err });
      });
    }

    // System audio loopback via WASAPI (dshow loopback)
    // This captures whatever the speakers are playing — Zoom/Meet audio
    const loopbackDevice = await this.getDefaultLoopbackDevice();
    if (loopbackDevice) {
      this.loopbackProcess = spawn(
        ffmpegPath,
        [
          "-f", "dshow",
          "-i", `audio=${loopbackDevice}`,
          "-ar", String(this.sampleRate),
          "-ac", String(this.channels),
          "-f", "s16le",
          "-acodec", "pcm_s16le",
          "-block_size", "3200",
          "pipe:1",
        ],
        { stdio: ["ignore", "pipe", "pipe"] }
      );

      this.loopbackProcess.stdout?.on("data", (chunk: Buffer) => {
        this.emit("audio", { source: "loopback", data: chunk });
      });

      this.loopbackProcess.stderr?.on("data", (data: Buffer) => {
        if (process.env.DEBUG_AUDIO) {
          console.log("[audio:loopback]", data.toString());
        }
      });

      this.loopbackProcess.on("error", (err: NodeJS.ErrnoException) => {
        console.error("[audio:loopback] process error:", err);
        if (err.code === "ENOENT") {
          this.emit("diagnostic", {
            level: "error",
            message: "ffmpeg was not found on PATH — audio capture is impossible. Install it with: winget install Gyan.FFmpeg, then restart Orbit.",
          });
        } else {
          this.emit("diagnostic", { level: "error", message: `System-audio capture failed: ${err.message}` });
        }
        this.emit("error", { source: "loopback", error: err });
      });
    }

    // Surface exactly which pieces are missing so the UI can explain itself.
    if (!this.micProcess && !this.loopbackProcess) {
      this.emit("diagnostic", {
        level: "error",
        message: "No audio devices were found — Orbit cannot hear the interview. Check your microphone and system-audio (loopback) setup, then restart the app.",
      });
    } else {
      if (!this.micProcess) {
        this.emit("diagnostic", {
          level: "error",
          message: "No microphone detected — Orbit cannot hear the interviewer's questions.",
        });
      }
      if (!this.loopbackProcess) {
        this.emit("diagnostic", {
          level: "warn",
          message: "No system-audio (loopback) device found. Install a virtual audio cable such as VB-CABLE (free) and set it as the default playback device to capture the interviewer's voice directly.",
        });
      }
      if (this.micProcess && this.loopbackProcess) {
        this.emit("diagnostic", { level: "ok", message: "Microphone + system-audio capture running (16 kHz, mono)." });
      }
    }
  }

  private async startMacCapture(ffmpegPath: string): Promise<void> {
    // macOS: use avfoundation for mic, and BlackHole/Loopback for system audio
    this.micProcess = spawn(
      ffmpegPath,
      [
        "-f", "avfoundation",
        "-i", ":0", // default audio input device
        "-ar", String(this.sampleRate),
        "-ac", String(this.channels),
        "-f", "s16le",
        "-acodec", "pcm_s16le",
        "-block_size", "3200",
        "pipe:1",
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    this.micProcess.stdout?.on("data", (chunk: Buffer) => {
      this.emit("audio", { source: "mic", data: chunk });
    });

    this.micProcess.on("error", (err) => {
      this.emit("error", { source: "mic", error: err });
    });
  }

  private async getDefaultMicDevice(): Promise<string | null> {
    return this.listDshowDevices("audio");
  }

  private async getDefaultLoopbackDevice(): Promise<string | null> {
    return this.listDshowDevices("loopback");
  }

  /**
   * Enumerate DirectShow audio devices via ffmpeg `-list_devices`,
   * returning either the first input device ("audio") or the first
   * loopback device ("loopback") when such is installed.
   */
  private async listDshowDevices(
    which: "audio" | "loopback"
  ): Promise<string | null> {
    return new Promise((resolve) => {
      const proc = spawn(
        this.findFfmpeg(),
        ["-f", "dshow", "-list_devices", "true", "-i", "dummy"],
        { stdio: ["ignore", "pipe", "pipe"], windowsHide: true }
      );

      let stderr = "";
      proc.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on("error", () => resolve(null));
      proc.on("close", () => {
        const lines = stderr.split("\n");
        let inAudio = false;
        for (const line of lines) {
          if (line.includes("[dshow @")) {
            if (line.includes("DirectShow audio devices")) inAudio = true;
            else inAudio = false;
          }
          if (!inAudio || !line.includes('"')) continue;

          // Skip "Alternative name" lines — capture the primary name
          if (line.trim().startsWith('Alternative name')) continue;

          const match = line.match(/"([^"]+)"/);
          if (!match) continue;

          const name = match[1];
          const isLoopback = name.includes("(loopback)") ||
            name.toLowerCase().includes("virtual audio") ||
            name.toLowerCase().includes("cable");

          if (which === "loopback" && isLoopback) {
            resolve(name);
            return;
          }
          if (which === "audio" && !isLoopback) {
            // directshow lists "None 2" and similar dummy entries first;
            // filter those out
            if (/^(none|softwar)\s?\d*/i.test(name)) continue;
            resolve(name);
            return;
          }
        }
        resolve(null);
      });
    });
  }

  async getDevices(): Promise<AudioDevice[]> {
    const devices: AudioDevice[] = [];
    // Simplified — in production, enumerate via WASAPI/CoreAudio
    devices.push({ id: "default-mic", name: "Default Microphone", type: "microphone" });
    devices.push({ id: "default-loopback", name: "Default System Audio", type: "loopback" });
    return devices;
  }

  private findFfmpeg(): string {
    // Check common paths for ffmpeg
    const ffmpeg = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
    // Assume ffmpeg is on PATH in development
    return ffmpeg;
  }

  async stop(): Promise<void> {
    this.running = false;
    this.micProcess?.kill("SIGTERM");
    this.loopbackProcess?.kill("SIGTERM");
    this.micProcess = null;
    this.loopbackProcess = null;
  }
}
