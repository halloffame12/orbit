# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Quit hotkey (`Ctrl+Shift+Q`), a ⏻ quit button on the overlay HUD, and a
  shortcuts reference inside the Settings modal.
- Overlay placement presets (top-center / top-right / bottom-right /
  bottom-left) with a share-safe tip, so a full-screen share never covers
  content you are presenting — park the overlay over your own camera tile.

## [1.0.0] - 2026-09-10

### Added
- Real-time AI interview copilot for Windows with a screen-share-proof overlay
  (`SetWindowDisplayAffinity` with `WDA_EXCLUDEFROMCAPTURE`).
- Dual audio capture: microphone + system loopback with speaker diarization.
- Speech-to-text via Deepgram live streaming or a local whisper.cpp server,
  with Silero VAD (energy-based fallback).
- Two interview modes:
  - **Behavioral** — auto-answers interviewer questions with concise bullets.
  - **Live coding** — `Ctrl+Shift+S` captures the screen and solves the problem
    (Complexity / Intuition / Code / Edge Cases).
- Multi-provider LLM streaming: OpenAI, Google Gemini, Anthropic Claude, and
  any OpenAI-compatible (local) endpoint — with vision support.
- Encrypted secret storage via Windows `safeStorage` (DPAPI).
- Settings modal with per-provider connection testing.
- Electron-builder packaging: NSIS installer + portable `.exe`.
- Global hotkeys (visibility, click-through, force-generate, snip/solve,
  clear, settings).
- Landing page (`/website`) built with Vite + React + Tailwind.
- GitHub Actions CI + release pipeline with auto-generated installers.