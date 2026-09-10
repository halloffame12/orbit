import { EventEmitter } from "events";
import { createClient, LiveClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import fs from "fs";
import path from "path";

export interface STTConfig {
  provider: "deepgram" | "local";
  apiKey?: string;
  model: string;
  vadThresholdMs: number;
  whisperUrl?: string;
}

export interface TranscriptEvent {
  speaker: "Interviewer" | "Me";
  text: string;
  timestamp: number;
}

interface VADResult {
  isSpeech: boolean;
  confidence: number;
}

/**
 * VADService - Silero VAD integration.
 * Loads the silero_vad.onnx model (drop it in src/main/models/) and runs it
 * with onnxruntime-node. Falls back to RMS energy detection when the model
 * is not present.
 *
 * Input expectations: 16 kHz mono int16 PCM, ~20ms chunks.
 */
class VADService extends EventEmitter {
  private isSpeech = false;
  private speechFrames = 0;
  private silenceFrames = 0;
  private chunkMs = 20;
  private vadInstance: any = null;
  private ort: any = null;
  private windowSize = 512;
  private context: Buffer = Buffer.alloc(0);

  constructor(private config: STTConfig) {
    super();
  }

  async load(): Promise<boolean> {
    try {
      this.ort = require("onnxruntime-node");
      const modelPath = path.join(__dirname, "../models/silero_vad.onnx");

      if (!fs.existsSync(modelPath)) {
        console.warn("[vad] Silero model absent - using energy-based VAD fallback");
        return false;
      }

      this.vadInstance = await this.ort.InferenceSession.create(modelPath);
      console.log("[vad] Silero VAD loaded");
      return true;
    } catch (err: any) {
      if (err?.code === "MODULE_NOT_FOUND") {
        console.warn("[vad] onnxruntime-node not installed - using energy-based VAD fallback");
      } else {
        console.warn("[vad] Silero VAD unavailable - using energy-based fallback:", err);
      }
      return false;
    }
  }

  /**
   * Feed a PCM chunk (~20ms @16kHz → 640 bytes). Emits `speech-start`
   * and `speech-end` around each detected utterance.
   */
  processPCM(chunk: Buffer, source: string): VADResult {
    const isSpeech = this.vadInstance
      ? this.runSilero(chunk)
      : this.energyDetection(chunk);

    const now = Date.now();

    if (isSpeech && !this.isSpeech) {
      this.isSpeech = true;
      this.speechFrames = 0;
      this.silenceFrames = 0;
      this.emit("speech-start", { source, time: now });
    }

    if (isSpeech) {
      this.speechFrames++;
      this.silenceFrames = 0;
    } else {
      this.silenceFrames++;
    }

    const silenceMs = this.silenceFrames * this.chunkMs;
    if (this.isSpeech && silenceMs >= this.config.vadThresholdMs) {
      this.isSpeech = false;
      const frames = this.speechFrames;
      this.speechFrames = 0;
      this.silenceFrames = 0;
      this.emit("speech-end", { source, time: now, frames });
    }

    return { isSpeech: this.isSpeech, confidence: isSpeech ? 0.9 : 0.05 };
  }

  /**
   * Run the Silero model on a rolling context window.
   * Input: 1xNx1 int16 tensor; yields per-chunk speech probability.
   */
  private runSilero(chunk: Buffer): boolean {
    try {
      // Maintain a 512-sample sliding window (model expects 512-sample frames)
      this.context = Buffer.concat([this.context, chunk]);
      const needs = 512 * 2; // 512 samples * 2 bytes
      if (this.context.length < needs) return false;
      this.context = this.context.slice(-needs);

      const input = new Float32Array(512);
      for (let i = 0; i < 512; i++) {
        input[i] = this.context.readInt16LE(i * 2) / 32768;
      }

      if (this.vadInstance) {
        const feeds: Record<string, any> = {
          input: new this.ort.Tensor("float32", input, [1, 512]),
        };
        const outputs = this.vadInstance.run(feeds) as Record<string, any>;
        const prob =
          Object.values(outputs)[0]?.data?.[0] ?? outputs[0]?.data?.[0] ?? 0;
        return prob > 0.5;
      }
      return false;
    } catch (err) {
      console.warn("[vad] Silero inference error:", err);
      return this.energyDetection(chunk);
    }
  }

  private energyDetection(chunk: Buffer): boolean {
    let sum = 0;
    const samples = chunk.length / 2;
    for (let i = 0; i < chunk.length; i += 2) {
      const sample = chunk.readInt16LE(i);
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / Math.max(samples, 1));
    // Adaptive-ish heuristic: silence floor ~-40dBFS ≈ RMS 8
    return rms > 8;
  }
}

/**
 * STTService - Streaming speech-to-text with speaker diarization.
 *
 * Two modes:
 *  - deepgram: single live WebSocket for both streams; the most recent
 *    active source determines the speaker tag for each transcript.
 *  - local (whisper.cpp): each VAD-delimited utterance is PCM-buffered and
 *    POSTed to a whisper.cpp HTTP server (--port 9022 style, server-mode)
 *    for transcription. Utterance boundaries give natural turn detection.
 *
 * Emits:
 *   - transcript         (TranscriptEvent] final line)
 *   - speaker-change     (whom is talking now + frame count)
 *   - interviewer-question (text to feed the LLM)
 */
export class STTService extends EventEmitter {
  private vad: VADService;
  private deepgram: LiveClient | null = null;
  private transcript: TranscriptEvent[] = [];
  private interviewerAccum: string = "";
  private meAccum: string = "";

  // Utterance PCM buffers for whisper.cpp mode
  private utterances: Record<string, Buffer[]> = { mic: [], loopback: [] };
  private activeUtterance: Record<string, boolean> = { mic: false, loopback: false };

  constructor(private config: STTConfig) {
    super();
    this.vad = new VADService(config);
  }

  async connect(): Promise<void> {
    await this.vad.load();

    // VAD → utterance lifecycle for BOTH streams
    this.vad.on("speech-start", ({ source }) => {
      this.activeUtterance[source] = true;
      this.utterances[source] = [];
      this.emit("speaker-change", {
        speaker: source === "mic" ? "Me" : "Interviewer",
        frames: 0,
        time: Date.now(),
      });
    });

    this.vad.on("speech-end", async ({ source, frames }) => {
      this.activeUtterance[source] = false;
      const speaker = source === "mic" ? "Me" : "Interviewer";

      if (this.deepgram) {
        // Deepgram mode: transcription already streamed; fire the question
        // on the interviewer's turn ending.
        if (speaker === "Interviewer") {
          const q = this.interviewerAccum.trim();
          this.interviewerAccum = "";
          if (q.length > 15) this.emit("interviewer-question", q);
        } else {
          this.meAccum = "";
        }
      } else {
        // Local whisper.cpp mode: transcribe the whole buffered utterance.
        await this.finalizeLocalUtterance(source);
      }

      this.emit("speaker-change", {
        speaker,
        frames,
        time: Date.now(),
      });
    });

    if (this.config.provider === "deepgram" && this.config.apiKey) {
      await this.connectDeepgram();
    } else {
      console.log(`[stt] Local mode - will transcribe utterances via whisper.cpp at ${this.config.whisperUrl ?? "http://localhost:9022"}`);
    }
  }

  /** Buffer PCM while VAD says speech; transcribe the whole utterance at the end. */
  private async finalizeLocalUtterance(source: string): Promise<void> {
    const buffers = this.utterances[source];
    this.utterances[source] = [];
    if (!buffers.length) return;

    const pcm = Buffer.concat(buffers);
    const speaker = source === "mic" ? "Me" : "Interviewer";
    const text = await this.transcribeWhisper(pcm);

    if (text.trim().length < 3) return;

    this.recordLine(speaker, text.trim());

    if (speaker === "Interviewer") {
      this.emit("interviewer-question", text.trim());
    } else {
      this.emit("user-utterance", text.trim());
    }
  }

  private async transcribeWhisper(pcm: Buffer): Promise<string> {
    const url = this.config.whisperUrl ?? "http://localhost:9022";
    if (!pcm.length) return "";

    // whisper.cpp server expects WAV16 (16000 Hz mono) via /inference
    const wav = this.pcmToWav(pcm);

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);

      const form = new FormData();
      form.append("file", new Blob([wav], { type: "audio/wav" }), "utt.wav");
      form.append("response_format", "json");

      const res = await fetch(`${url}/inference`, {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) return "";
      const json: any = await res.json();
      return json.text ?? json.transcription ?? "";
    } catch (err) {
      console.warn("[stt] whisper.cpp transcription failed:", err);
      return "";
    }
  }

  private pcmToWav(pcm: Buffer): Buffer {
    const header = Buffer.alloc(44);
    header.write("RIFF", 0);
    header.writeUInt32LE(36 + pcm.length, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16); // PCM chunk size
    header.writeUInt16LE(1, 20); // audio format = PCM
    header.writeUInt16LE(1, 22); // mono
    header.writeUInt32LE(16000, 24); // sample rate
    header.writeUInt32LE(16000 * 2, 28); // byte rate
    header.writeUInt16LE(2, 32); // block align
    header.writeUInt16LE(16, 34); // bits per sample
    header.write("data", 36);
    header.writeUInt32LE(pcm.length, 40);
    return Buffer.concat([header, pcm]);
  }

  private async connectDeepgram(): Promise<void> {
    const deepgram = createClient(this.config.apiKey!);
    this.deepgram = deepgram.listen.live({
      model: this.config.model || "nova-2-general",
      language: "en",
      interim_results: true,
      smart_format: true,
      punctuate: true,
      endpointing: 500,
    });

    this.deepgram.on(LiveTranscriptionEvents.Open, () => {
      console.log("[stt] Deepgram connection open");
    });

    this.deepgram.on(LiveTranscriptionEvents.Transcript, (data: any) => {
      const isFinal = !data.is_final;
      const text = data.channel?.alternatives?.[0]?.transcript ?? "";
      if (!text.trim()) return;

      const speaker = this.lastActiveSource === "mic" ? "Me" : "Interviewer";

      if (speaker === "Me") {
        this.meAccum += ` ${text}`;
      } else {
        this.interviewerAccum += ` ${text}`;
      }

      if (isFinal) {
        this.recordLine(speaker, text.trim());
      }
    });

    this.deepgram.on(LiveTranscriptionEvents.Error, (err: Error) => {
      console.error("[stt] Deepgram error:", err);
      this.emit("error", err);
    });

    this.deepgram.on(LiveTranscriptionEvents.Close, () => {
      console.log("[stt] Deepgram connection closed");
    });
  }

  private lastActiveSource: "mic" | "loopback" = "loopback";

  private recordLine(speaker: "Interviewer" | "Me", text: string): void {
    const event: TranscriptEvent = {
      speaker,
      text,
      timestamp: Date.now(),
    };
    this.transcript.push(event);
    if (this.transcript.length > 25) {
      this.transcript.shift();
    }
    this.emit("transcript", event);
  }

  sendAudio(chunk: { source: string; data: Buffer }): void {
    this.lastActiveSource = chunk.source as "mic" | "loopback";

    // VAD on both streams drives turn detection + local-mode extraction
    const vadResult = this.vad.processPCM(chunk.data, chunk.source);

    // Buffer speech frames for whisper.cpp transcription
    if (this.activeUtterance[chunk.source]) {
      this.utterances[chunk.source].push(chunk.data);
    }

    // Streaming transcription for Deepgram mode
    if (this.deepgram) {
      try {
        const view = chunk.data;
        const arrayBuffer = view.buffer.slice(
          view.byteOffset,
          view.byteOffset + view.byteLength
        ) as ArrayBuffer;
        if (vadResult.isSpeech) {
          this.deepgram.send(arrayBuffer);
        }
      } catch (e) {
        // ignore per-chunk errors
      }
    }
  }

  getTranscript(): TranscriptEvent[] {
    return [...this.transcript];
  }

  clearTranscript(): void {
    this.transcript = [];
    this.interviewerAccum = "";
    this.meAccum = "";
  }

  async disconnect(): Promise<void> {
    if (this.deepgram) {
      await this.deepgram.finish();
      this.deepgram = null;
    }
  }
}