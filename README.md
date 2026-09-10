# Orbit — AI Interview Copilot

![CI](https://github.com/halloffame12/orbit/actions/workflows/ci.yml/badge.svg)
![Release](https://github.com/halloffame12/orbit/actions/workflows/release.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-00E5A0.svg)

> **Download:** [installer](https://github.com/halloffame12/orbit/releases/latest/download/Orbit.Setup.exe) ·
> [portable](https://github.com/halloffame12/orbit/releases/latest/download/Orbit.Portable.exe)

A real-time, low-latency interview copilot that runs invisibly during video calls (Zoom, Google Meet, Teams). It captures both your microphone and the system loopback audio, transcribes the conversation, detects when the interviewer finishes a question, and streams 3–4 punchy bullet-point answers into a teleprompter window positioned under your camera — without ever appearing in a screen share.

Two **modes**:
- **Behavioral / mock** — auto-answers the interviewer's questions with concise bullet points.
- **Live coding** — press `Ctrl/⌘ + Shift + S` to silently capture the problem and get Complexity / Intuition / Code / Edge Cases.

Supports **OpenAI, Google Gemini, Anthropic Claude, and local OpenAI-compatible** models, plus a full **Windows installer + portable .exe** via electron-builder.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        MAIN PROCESS (Node)                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐ │
│  │ AudioCapture │──▶│  STTService  │──▶│  LLMStreaming    │ │
│  │ mic + WASAPI │   │  Silero VAD  │   │  OpenAI-compatible│ │
│  │ loopback     │   │  Deepgram /  │   │  SSE stream      │ │
│  │ (ffmpeg dshow)│  │  whisper.cpp │   │  /v1/chat/       │ │
│  └──────┬───────┘   └──────┬───────┘   │  completions     │ │
│         │    transcript    │  question  └────────┬─────────┘ │
│         │  speaker change  │  tokens ▾───────────┤           │
│         └──────────────────┴────────────────────┘           │
│                             │ token / complete / error       │
│  ┌──────────────────────────▼────────────────────────────┐   │
│  │ IPC bridge (contextBridge, preload/index.ts)          │   │
│  └──────────────────────────┬────────────────────────────┘   │
└─────────────────────────────┼────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────┐
│                RENDERER (React + Tailwind)                   │
│   Teleprompter • auto-scroll • opacity • streaming caret     │
│   Global hotkeys via main-process globalShortcut             │
└──────────────────────────────────────────────────────────────┘

Native C++ addon ── SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)
  └ (falls back to a PowerShell SetWindowDisplayAffinity call if the
     .node addon hasn't been compiled)
```

### Screen-share invisibility (Windows)

The overlay window is excluded from **every** DWM capture path — Windows
Graphics Capture (Zoom/Meet/Teams), DXGI Desktop Duplication, BitBlt and
`PrintWindow` — via the Win32 call:

```cpp
SetWindowDisplayAffinity(hwnd, 0x00000011); // WDA_EXCLUDEFROMCAPTURE
```

Implemented in `src/main/native/screen_hide.cc` (N-API addon). If the addon
isn't compiled, `src/main/native/screen-hide.ts` issues the same call through
a PowerShell P/Invoke — the behavior is identical. Verified at runtime:

```
[main] Screen hiding applied: true
```

On macOS the equivalent is `NSWindow.sharingType = .none`, stubbed in the
same wrapper for `setAlwaysOnTop`/full-screen-safe positioning.

---

## Getting started

```bash
npm install

# Build the TS bundles
npm run build

# Compile the native screen-hide addon (needs "Desktop development with C++")
npm run native:build

# Launch
npm start
```

> `electron .` in dev will try the Vite dev server first, then transparently
> fall back to the built bundle in `dist/renderer`.

### Required runtime tools

| Component        | Requirement                                                              |
|------------------|--------------------------------------------------------------------------|
| `ffmpeg`         | On `PATH`. Captures mic (dshow) + loopback (dshow filter) → PCM 16 kHz.   |
| STT              | Either a Deepgram API key (**Deepgram mode**) or a running whisper.cpp server (`--server`, default `http://localhost:9022`, **local mode**). |
| LLM              | OpenAI, Gemini, Claude, or any OpenAI-compatible endpoint (defaults to Ollama `http://localhost:11434` model `llama3.1`, vision `llava`). Configured in the Settings modal — keys are encrypted with Windows `safeStorage`. |
| Silero VAD (opt) | Drop `silero_vad.onnx` into `src/main/models/`. Falls back to RMS energy detection. |

### Configuration

The app auto-creates `config.json` and `profile.json` in Electron's
`userData` directory. A sample profile lives at `config/profile.example.json`
— copy it to your `userData` folder or set it via `ipc:save-profile`.

STT/LLM/overlay defaults:

```jsonc
{
  "mode":   "behavioral",
  "stt":    { "provider": "local", "whisperUrl": "http://localhost:9022", "vadThresholdMs": 800 },
  "llm":    { "provider": "local", "apiKeyEnc": "", "baseUrl": "http://localhost:11434",
              "model": "llama3.1", "visionModel": "llava", "temperature": 0.3, "maxTokens": 400 },
  "overlay":{ "opacity": 0.95, "width": 420, "height": 220, "fontSize": 26, "padding": 16 }
}
```

### Hotkeys

| Shortcut                 | Action                                     |
|--------------------------|--------------------------------------------|
| `Ctrl/⌘ + Shift + H`     | Toggle window visibility                   |
| `Ctrl/⌘ + Shift + C`     | Toggle click-through (ignore mouse)         |
| `Ctrl/⌘ + Shift + Space` | Force-trigger an LLM response right now    |
| `Ctrl/⌘ + Shift + S`     | Capture screen & solve (live coding mode)  |
| `Ctrl/⌘ + Shift + X`     | Clear context / abort the current stream   |
| `Ctrl/⌘ + Shift + O`     | Open settings                              |

Hotkeys are registered as OS-level `globalShortcut`s, so they work even when
the overlay is click-through or unfocused.

---

## How the pipeline works

1. **Capture** — `audio-capture.ts` spawns two ffmpeg processes:
   - `dshow` mic input → `[Me]` source
   - system loopback (or a virtual cable with `(loopback)` in the name) → `[Interviewer]` source
   Both output raw `pcm_s16le` @ 16 kHz mono in ~100 ms chunks.

2. **VAD + diarization** — `stt-service.ts` runs Silero VAD on *both* streams.
   A `speech-end` after silence ≥ `vadThresholdMs` (default 800 ms) closes the
   interviewer's turn → that's the trigger to generate.

3. **Transcription**
   - **Deepgram mode**: a single live WebSocket receives both streams
     (tagged by the most recent active source) and emits final transcripts.
   - **Local mode**: each VAD-delimited utterance is PCM-buffered, wrapped as
     WAV, and POSTed to whisper.cpp's `/inference` for transcription.

4. **Prompt** — `llm-service.ts` builds a prompt from:
   - the candidate profile (`resumeSummary`, `technicalStrengths`, STAR stories)
   - the last 15–20 dialogue turns (sliding window)
   - the interviewer's latest question
   System instruction: *3–4 short, punchy, high-impact bullets, <50 words,
   metrics + technical concepts, no conversational filler.*
   The service talks to **OpenAI, Gemini, Claude, or any OpenAI-compatible**
   endpoint through provider-specific stream adapters (SSE).

5. **Coding solver** — in coding mode, `Ctrl/⌘ + Shift + S` captures the
   visible screen (`capture-service.ts`, downscaled) and sends it to the
   configured vision model, which returns Complexity / Intuition / Code /
   Edge Cases rendered as structured sections in the teleprompter.

6. **Streaming UI** — tokens arrive via SSE and update the teleprompter
   token-by-token (`ipc:llm-token`), auto-scrolling with a blinking caret.
   Metrics in the status chip (latency + token count) update live.

---

## Project structure

```
src/
├── main/
│   ├── index.ts                      # app lifecycle, window, hotkeys, IPC
│   ├── native/
│   │   ├── binding.gyp               # node-gyp config
│   │   ├── screen_hide.cc            # N-API addon: SetWindowDisplayAffinity
│   │   └── screen-hide.ts            # loader + PowerShell/no-addon fallback
│   └── services/
│       ├── audio-capture.ts          # dual-channel capture (ffmpeg dshow)
│       ├── capture-service.ts        # silent screen capture for coding solver
│       ├── stt-service.ts            # Silero VAD + Deepgram / whisper.cpp
│       ├── llm-service.ts            # OpenAI / Gemini / Claude / local streaming
│       └── config-manager.ts         # config.json / profile.json + DPAPI encryption
├── preload/
│   └── index.ts                      # contextBridge → window.orbit
└── renderer/
    ├── index.html
    └── src/
        ├── App.tsx                   # overlay shell (border, HUD, settings)
        ├── components/Teleprompter.tsx
        ├── components/SettingsModal.tsx
        ├── hooks/useCopilot.ts       # IPC state bridge
        └── lib/types.ts              # shared typings + window.orbit
config/
└── profile.example.json              # candidate background / STAR stories
website/                              # landing page (Vite + React + Tailwind)
scripts/                              # make-icon.ps1 / make-icon.js (app icon)
```

### Build the native addon

Requires VS "Desktop development with C++". A full VS install with only the
IDE/MSBuild (no C++ workload) is **not** enough — `cl.exe` must be present:

```
npm run native:build
```

Output: `dist/main/native/screen_hide.node`. When absent, the PowerShell
fallback keeps the screen-hiding feature fully functional.

---

## Packaging (Windows)

```bash
# Generate build/icon.ico (drawn programmatically, no assets needed)
npm run icon

# NSIS installer + portable .exe → release/
npm run package:win

# Quick unpacked folder (no installer) → release/win-unpacked/
npm run package:win:unpacked
```

Artifacts:
- `release/Orbit.Setup.1.0.0.exe` — NSIS installer (offline, no admin required)
- `release/Orbit.Portable.1.0.0.exe` — portable build, runs anywhere
- `release/win-unpacked/Orbit Copilot.exe` — unpacked app dir

electron-builder config lives in the `build` field of `package.json`
(`asar` + native `.node` unpacked via `asarUnpack`). `signAndEditExecutable`
is `false` — signing can be enabled by supplying a certificate.

### Landing page

```bash
npm run dev:website    # local preview at localhost:5174
npm run build:website  # static site → dist/website/
```

### Publishing a release

Releases are automated end-to-end via GitHub Actions:

```bash
# Bump version in package.json + CHANGELOG.md, then:
git tag v1.0.0
git push origin v1.0.0
```

Pushing a `v*` tag triggers the `Release` workflow, which builds both
installers on a Windows runner and uploads them to a GitHub Release. The
landing page's download buttons always resolve to the latest release via
`releases/latest/download/...`.

> The app is currently **unsigned** (`signAndEditExecutable: false`). Windows
> SmartScreen may warn on first run; a code-signing certificate can be added
> later without changing the pipeline.

---

## Security notes

- The window is `focusable: false` and `skipTaskbar: true` — it can't steal
  focus during a call, and the teleprompter never appears in captures.
- API keys are encrypted to `config.json` under `userData` via Windows
  `safeStorage` (DPAPI) — never plaintext, never in the repo.
- Strict CSP on the renderer; `contextIsolation: true`, `sandbox: false`
  (preload needs Node APIs; all privileged calls stay in main).
- Status HUD, transcript, and answers are all inside the excluded window.

## Limitations / roadmap

- Loopback capture relies on a system loopback or virtual-audio cable device
  exposing `(loopback)` via DirectShow. Some setups need a driver, e.g.
  VB-CABLE or one of the loopback-enabled sound cards.
- Speaker diarization in Deepgram mode uses a per-stream activity heuristic
  rather than a dedicated diarization model; a separate Deepgram `diarize`
  connection is a straightforward upgrade.
- Local STT (whisper.cpp) is utterance-batched (not word-streaming) by design;
  swap to the Deepgram live path for token-rate transcription.