# SPIKE v2.2 — Product audit & hardening

- Added a browser-compatible ID fallback when `crypto.randomUUID()` is unavailable.
- Added a shared JSON API helper with timeout/error handling for AI requests.
- Improved AI input validation and bounded message size.
- Replaced fragile direct localStorage parsing in key AI/action flows with guarded storage helpers.
- Added transaction validation and a clear user-facing error for invalid amounts/descriptions.
- Added a confirmation before deleting recorded transactions.
- Added transaction description length protection.
- Added an additional server cross-origin resource policy header.
- Updated package version to 2.2.0.

## Verification
- Server syntax: `node --check server/index.mjs`
- Frontend source: requires `npm install` before the full Vite build.
- ZIP integrity: verified after packaging.
