import { EventEmitter } from "events";

export type ProviderId = "openai" | "gemini" | "claude" | "local";

export interface LLMConfig {
  provider: ProviderId;
  apiKey: string;
  baseUrl: string;
  model: string;
  visionModel: string;
  maxTokens: number;
  temperature: number;
}

export interface TranscriptLine {
  speaker: string;
  text: string;
  timestamp: number;
}

export interface CandidateProfile {
  name: string;
  targetRole: string;
  resumeSummary: string;
  technicalStrengths: string[];
  stories: STAR[];
  weaknesses: string;
  currentCompany?: string;
  yearsExperience?: number;
}

interface STAR {
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  metric: string;
}

export const PROVIDER_META: Record<ProviderId, { label: string; defaultBaseUrl: string; defaultModel: string; defaultVisionModel: string; needsKey: boolean }> = {
  openai: {
    label: "OpenAI",
    defaultBaseUrl: "https://api.openai.com",
    defaultModel: "gpt-4o-mini",
    defaultVisionModel: "gpt-4o-mini",
    needsKey: true,
  },
  gemini: {
    label: "Google Gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
    defaultModel: "gemini-2.5-flash",
    defaultVisionModel: "gemini-2.5-flash",
    needsKey: true,
  },
  claude: {
    label: "Anthropic Claude",
    defaultBaseUrl: "https://api.anthropic.com",
    defaultModel: "claude-3-5-haiku",
    defaultVisionModel: "claude-3-5-haiku",
    needsKey: true,
  },
  local: {
    label: "Local / Custom (OpenAI-compatible)",
    defaultBaseUrl: "http://localhost:11434",
    defaultModel: "llama3.1",
    defaultVisionModel: "llava",
    needsKey: false,
  },
};

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  provider: "local",
  apiKey: "",
  baseUrl: PROVIDER_META.local.defaultBaseUrl,
  model: PROVIDER_META.local.defaultModel,
  visionModel: PROVIDER_META.local.defaultVisionModel,
  maxTokens: 400,
  temperature: 0.3,
};

/* ------------------------------------------------------------------ */
/* SSE helpers                                                         */
/* ------------------------------------------------------------------ */

/**
 * Consume a fetch Response body and invoke `onData` for every
 * `data:` line found. Tolerant to CRLF, `event:` lines and chunks.
 */
async function streamSSE(
  response: Response,
  onData: (json: any) => void,
  signal: AbortSignal
): Promise<void> {
  if (!response.body) throw new Error("Empty response body from provider");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data:")) {
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          onData(JSON.parse(payload));
        } catch {
          // ping/keep-alive or partial payload — ignore
        }
      }
    }
  }
}

function normalizeOpenAIBase(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, "");
  if (/\/v\d+$/.test(base)) return base;
  return `${base}/v1`;
}

function cnvB64(png: Buffer): string {
  return png.toString("base64");
}

/* ------------------------------------------------------------------ */
/* Request / response shaping per provider                             */
/* ------------------------------------------------------------------ */

interface ProviderIO {
  /** Non-streaming request for the connection test. */
  testRequest(cfg: LLMConfig): { url: string; init: RequestInit };
  /** Streaming text completion. onToken receives incremental text. */
  streamText(cfg: LLMConfig, messages: any[], onToken: (t: string) => void, signal: AbortSignal): Promise<void>;
}

/** Messages shape → translate per provider. */
function buildTextMessages(cfg: LLMConfig, system: string, user: string): any[] {
  if (cfg.provider === "gemini") {
    return [
      { role: "user", parts: [{ text: [system, "", user].join("\n\n") }] },
    ];
  }
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

/** Build a vision user message for a provider, given a PNG screenshot. */
function buildVisionUserMessage(cfg: LLMConfig, prompt: string, png: Buffer): any[] {
  const b64 = cnvB64(png);
  if (cfg.provider === "gemini") {
    return [
      {
        role: "user",
        parts: [
          { text: prompt },
          { inline_data: { mime_type: "image/png", data: b64 } },
        ],
      },
    ];
  }
  if (cfg.provider === "claude") {
    return [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image", source: { type: "base64", media_type: "image/png", data: b64 } },
        ],
      },
    ];
  }
  if (cfg.provider === "local") {
    // Ollama / llama.cpp style in the same payload family
    return [{ role: "user", content: prompt, images: [b64] }];
  }
  // OpenAI / compatible
  return [
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:image/png;base64,${b64}` } },
      ],
    },
  ];
}

/* ----------------------------- OpenAI / local ----------------------------- */

async function openAIStream(
  base: string,
  cfg: LLMConfig,
  body: any,
  signal: AbortSignal,
  onToken: (t: string) => void
): Promise<void> {
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey || "sk-local"}`,
    },
    body: JSON.stringify({ ...body, stream: true }),
    signal,
  });
  if (!res.ok) throw new Error(`OpenAI-compatible API ${res.status}: ${(await res.text()).slice(0, 300)}`);

  await streamSSE(res, (json) => {
    const token: string = json.choices?.[0]?.delta?.content ?? "";
    if (token) onToken(token);
  }, signal);
}

async function openAITest(base: string, cfg: LLMConfig, body: any): Promise<void> {
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey || "sk-local"}`,
    },
    body: JSON.stringify({ ...body, stream: false, max_tokens: 1 }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json: any = await res.json();
  if (!json.choices?.[0]) throw new Error("Empty completion returned");
}

/* -------------------------------- Gemini -------------------------------- */

async function geminiStream(
  base: string,
  cfg: LLMConfig,
  body: any,
  signal: AbortSignal,
  onToken: (t: string) => void
): Promise<void> {
  const endpoint = `${base}/v1beta/models/${encodeURIComponent(body.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(cfg.apiKey)}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, stream: true }),
    signal,
  });
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${(await res.text()).slice(0, 300)}`);

  await streamSSE(res, (json) => {
    const token: string = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (token) onToken(token);
  }, signal);
}

async function geminiTest(base: string, cfg: LLMConfig, model: string): Promise<void> {
  const res = await fetch(
    `${base}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "ping" }] }] }),
      signal: AbortSignal.timeout(15000),
    }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

/* -------------------------------- Claude -------------------------------- */

async function claudeStream(
  base: string,
  cfg: LLMConfig,
  body: any,
  signal: AbortSignal,
  onToken: (t: string) => void
): Promise<void> {
  const res = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ ...body, stream: true }),
    signal,
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 300)}`);

  await streamSSE(res, (json) => {
    if (json.type === "content_block_delta" && json.delta?.text) {
      onToken(json.delta.text);
    }
  }, signal);
}

async function claudeTest(base: string, cfg: LLMConfig, model: string): Promise<void> {
  const res = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: "user", content: "ping" }] }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

/* ------------------------------------------------------------------ */
/* Orchestrator                                                        */
/* ------------------------------------------------------------------ */

/**
 * LLMStreamingService — universal multi-provider streaming client.
 *
 * Providers: OpenAI (gpt-4o-mini), Google Gemini (gemini-2.5-flash),
 * Anthropic Claude (claude-3-5-haiku) and any local OpenAI-compatible
 * endpoint (Ollama / vLLM / LM Studio / big-pickle gateway).
 *
 * Emits: start | token | complete | error
 */
export class LLMStreamingService extends EventEmitter {
  private controller: AbortController | null = null;

  constructor(private config: LLMConfig) {
    super();
  }

  updateConfig(cfg: LLMConfig): void {
    this.config = cfg;
  }

  private append(text: string, full: { current: string }): void {
    full.current += text;
    this.emit("token", { text: full.current, delta: text });
  }

  private emitError(err: unknown): void {
    if (err instanceof Error && err.name === "AbortError") {
      this.emit("error", new Error("Generation aborted"));
    } else {
      console.error("[llm]", err);
      this.emit("error", err instanceof Error ? err : new Error(String(err)));
    }
  }

  private runStream(streamFn: () => Promise<void>): void {
    this.controller = new AbortController();
    const startTime = Date.now();
    this.emit("start", {});

    streamFn()
      .then(() => {
        this.emit("complete", { text: "", elapsedMs: Date.now() - startTime });
      })
      .catch((err) => this.emitError(err));
  }

  /* Behavioral answer generation -------------------------------------- */

  async generateResponse(
    question: string,
    history: TranscriptLine[],
    profile: CandidateProfile
  ): Promise<void> {
    const prompt = this.buildPrompt(question, history, profile);
    const system = prompt.system;
    const user = prompt.user;
    const full = { current: "" };

    const streamFn = async () => {
      await this.providerStream(
        this.config.model,
        this.buildChatBody(this.config.model, system, user, undefined),
        (t) => this.append(t, full)
      );
    };
    this.runStream(streamFn);
  }

  async generateFromTranscript(
    transcript: TranscriptLine[],
    profile: CandidateProfile
  ): Promise<void> {
    const last = transcript[transcript.length - 1];
    if (!last) return;
    await this.generateResponse(last.text, transcript, profile);
  }

  /* Coding / vision solver -------------------------------------------- */

  /**
   * Solve a coding problem screenshot. The image is sent to the provider's
   * vision-capable model; structured sections stream into the overlay.
   */
  async solveScreenshot(png: Buffer): Promise<void> {
    const prompt = [
      "You are a coding interview copilot. Analyze the screen capture.",
      "It contains a programming problem statement, possibly with example input/output.",
      "Output EXACTLY this structure and nothing else:",
      "## Complexity",
      "Time: O(...)  |  Space: O(...)",
      "## Intuition",
      "- point 1",
      "- point 2",
      "## Code",
      "```python",
      "# clean, optimal solution with brief inline comments",
      "```",
      "## Edge Cases",
      "- edge case 1",
      "- edge case 2",
    ].join("\n");

    const messages = buildVisionUserMessage(this.config, prompt, png);
    const full = { current: "" };

    const streamFn = async () => {
      await this.providerStream(
        this.visionModel(),
        this.buildVisionBody(messages),
        (t) => this.append(t, full)
      );
    };
    this.runStream(streamFn);
  }

  /* Provider dispatch -------------------------------------------------- */

  private visionModel(): string {
    return this.config.visionModel || this.config.model;
  }

  private buildChatBody(model: string, system: string, user: string, imagePng?: Buffer): any {
    const messages = imagePng
      ? buildVisionUserMessage(this.config, user, imagePng)
      : buildTextMessages(this.config, system, user);
    return this.shapeBody(model, messages);
  }

  private buildVisionBody(messages: any[]): any {
    return this.shapeBody(this.visionModel(), messages);
  }

  /** Translate generic `messages` (chat or vision shape) to a provider body. */
  private shapeBody(model: string, messages: any[]): any {
    if (this.config.provider === "gemini") {
      return {
        contents: messages.map((m: any) => ({
          role: m.role === "system" ? "user" : m.role,
          parts: m.parts ?? [{ text: m.content }],
        })),
        generationConfig: {
          temperature: this.config.temperature,
          maxOutputTokens: this.config.maxTokens,
        },
      };
    }
    if (this.config.provider === "claude") {
      return {
        model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages: messages.filter((m: any) => m.role !== "system").map((m: any) => ({
          role: m.role,
          content: m.content ?? m.parts,
        })),
      };
    }
    // OpenAI / local
    return {
      model,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      messages,
    };
  }

  private async providerStream(
    model: string,
    body: any,
    onToken: (t: string) => void
  ): Promise<void> {
    const signal = this.controller!.signal;
    const p = this.config.provider;

    if (p === "gemini") {
      const base = this.base();
      await geminiStream(base, this.config, { ...body, model }, signal, onToken);
    } else if (p === "claude") {
      const base = this.base();
      await claudeStream(base, this.config, { ...body, model }, signal, onToken);
    } else {
      // openai + local
      const base = normalizeOpenAIBase(this.base());
      await openAIStream(base, this.config, { ...body, model }, signal, onToken);
    }
  }

  private base(): string {
    const meta = PROVIDER_META[this.config.provider];
    return this.config.baseUrl || meta.defaultBaseUrl;
  }

  /** Instant connectivity check used by the settings modal. */
  async testConnection(cfg: LLMConfig): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    const testCfg = { ...this.config, ...cfg };
    try {
      if (testCfg.provider === "gemini") {
        await geminiTest(this.base(), testCfg, testCfg.model);
      } else if (testCfg.provider === "claude") {
        await claudeTest(this.base(), testCfg, testCfg.model);
      } else {
        const body = {
          model: testCfg.model,
          messages: [{ role: "user", content: "ping" }],
        };
        await openAITest(normalizeOpenAIBase(this.base()), testCfg, body);
      }
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err: any) {
      return { ok: false, latencyMs: Date.now() - start, error: err?.message ?? String(err) };
    }
  }

  /* Prompt engineering -------------------------------------------------- */

  private buildPrompt(
    question: string,
    history: TranscriptLine[],
    profile: CandidateProfile
  ): { system: string; user: string } {
    const system = [
      "You are an expert interview copilot embedded as a bullet-point teleprompter.",
      "Respond ONLY with 3-4 short, punchy, high-impact bullet points.",
      "Under 50 words total. Answer the question directly.",
      "Highlight metrics and technical concepts. Do not write full conversational paragraphs.",
      "Use concrete numbers and specific technologies when possible.",
      "No filler, no hedging, no 'I would say' or 'I believe'.",
      "Format as a flat list with one bullet per line, starting with '•'.",
    ].join(" ");

    const historyText = history
      .slice(-20)
      .map((h) => `${h.speaker === "Interviewer" ? "Interviewer" : "Candidate"}: ${h.text.trim()}`)
      .join("\n");

    const profileSection = [
      `Candidate: ${profile.name}`,
      `Target Role: ${profile.targetRole}`,
      `Strongest technical areas: ${profile.technicalStrengths.join(", ")}`,
      `Resume summary: ${profile.resumeSummary}`,
      `Archive of achievements (for reference in answers):`,
      ...profile.stories.map(
        (s) =>
          `  - ${s.title}: ${s.situation}; Task: ${s.task}; Action: ${s.action}; Result: ${s.result} (metric: ${s.metric})`
      ),
      `Known weakness to retrofit: ${profile.weaknesses}`,
    ].join("\n");

    const user = [
      "CONTEXT - Candidate profile:",
      profileSection,
      "",
      "RECENT CONVERSATION:",
      historyText || "(call just started)",
      "",
      "THE INTERVIEWER'S LATEST QUESTION:",
      question,
    ].join("\n");

    return { system, user };
  }

  abort(): void {
    this.controller?.abort();
  }
}