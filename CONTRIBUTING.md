# Contributing to Orbit

Thanks for taking the time to contribute! Orbit is a Windows desktop
application built with Electron + TypeScript + React.

## Table of contents

- [Code of conduct](#code-of-conduct)
- [Development setup](#development-setup)
- [Project layout](#project-layout)
- [Workflow](#workflow)
- [Coding guidelines](#coding-guidelines)
- [Release process](#release-process)

## Code of conduct

Read and follow the [Code of Conduct](CODE_OF_CONDUCT.md). Be excellent to
each other.

## Development setup

Prerequisites:

- Node.js 20+ (we recommend the LTS release)
- npm 10+
- ffmpeg on `PATH` (captures mic + system loopback)
- Optional: Visual Studio with the "Desktop development with C++" workload to
  compile the native screen-hide addon (a PowerShell fallback keeps the
  feature working without it)

```bash
npm install
npm run build       # compile main + preload + renderer
npm start           # launch the app
```

Run the typechecker and the full build before pushing:

```bash
npm run typecheck
npm run build
```

## Project layout

```
src/
├── main/            # Electron main process (window, hotkeys, IPC, services)
│   ├── native/      # C++ screen-hiding addon (optional) + fallback
│   └── services/    # audio capture, STT, LLM, config, screen capture
├── preload/         # contextBridge → window.orbit
└── renderer/        # React overlay UI (teleprompter, settings)
website/             # Landing page (Vite + React + Tailwind)
scripts/             # Icon generation for packaging
```

## Workflow

1. Fork the repository and create a feature branch
   (`git checkout -b feat/my-change`).
2. Make your changes, keeping them focused and small.
3. Run `npm run typecheck` and `npm run build` — both must pass.
4. Add or update tests where applicable.
5. Commit with a clear message and push your branch.
6. Open a pull request against `main`.

## Coding guidelines

- Follow the existing code style; TypeScript `strict` is enforced.
- Do **not** add comments unless they explain a non-obvious decision.
- Never commit API keys, tokens, or any secrets.
- Keep privileged operations in the main process behind the preload bridge;
  the renderer never touches Node APIs directly.
- Prefer composition and small focused modules over big files.

## Release process

Releases are fully automated:

1. Bump the version in `package.json` and `CHANGELOG.md`.
2. Tag the release: `git tag v1.0.0 && git push origin v1.0.0`.
3. GitHub Actions builds the Windows installer + portable `.exe` and uploads
   them to a GitHub Release automatically.