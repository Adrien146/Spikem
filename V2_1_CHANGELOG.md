# SPIKE v2.1 — Reliability & polish

- Added a React error boundary with a safe refresh recovery screen.
- Added guarded localStorage helpers so storage failures do not crash the app.
- Added fetch timeouts for key client requests.
- Added server security headers and no-store headers for JSON APIs.
- Added lightweight per-IP endpoint rate limiting.
- Hardened static-file path resolution against traversal.
- Preserved SPIKE v2.0 features and creator identity.

## Testing
- Server syntax: `node --check server/index.mjs`
- ZIP integrity: verified after packaging.
- Full Vite build requires project dependencies (`npm install`) and should be run on the laptop.
