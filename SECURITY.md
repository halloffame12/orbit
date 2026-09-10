# Security Policy

## Reporting a Vulnerability

If you believe you have found a security vulnerability in Orbit, **please do
not open a public issue**. Instead, report it privately so it can be fixed
before disclosure:

- Open a [private security advisory](https://github.com/halloffame12/orbit/security/advisories/new)
- Or email the maintainer (address listed in the repository profile)

We ask that you give us **90 days** to respond and fix before disclosing the
issue publicly. You will not be contacted unless we need more information.

Please include:

- A description of the vulnerability and the affected component.
- Steps to reproduce.
- Whether you believe the issue can be exploited remotely.

## Scope

The following are explicitly **out of scope**:

- Issues that require physical access to the victim's machine.
- Social engineering of interviewers, candidates, or employers.
- Any behavior enabled by the user intentionally sharing their own secrets.

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 1.0.x   | ✓                  |

## Security Design Notes

- API keys are encrypted at rest with Windows `safeStorage` (DPAPI) before
  they ever touch disk.
- The overlay window is excluded from all OS capture paths via
  `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)`.
- The renderer runs with `contextIsolation: true` and no `nodeIntegration`;
  all privileged operations live in the main process behind a narrow IPC
  surface.