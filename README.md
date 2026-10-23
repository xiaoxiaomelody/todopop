# TODOPOP

Your tasks disappear when you’re working on them, and reappear when you’re not.

macOS-first hackathon project. Stack: Electron, React, TypeScript, Vite,
Tailwind CSS, Motion, Zustand, Chrome Manifest V3, localhost WebSocket, and local JSON.
No backend or cloud services.

## Development

Use Node.js 24+ and npm. The shared tests use Node’s built-in TypeScript support.

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
```

`npm run dev` starts the Electron desktop shell and Vite renderer.
`npm run build` produces desktop renderer/main/preload bundles and an unpacked
extension at `apps/chrome-extension/dist`. Load that folder through Chrome’s
Extensions → Developer mode → Load unpacked. The extension is a scaffold and
currently does not collect or send browser context.

## Structure

- `apps/desktop/electron`: main process, preload, bubble window and WebSocket integration modules.
- `apps/desktop/src`: React pages/components and Zustand store module.
- `apps/chrome-extension`: Manifest V3 service worker and connection module.
- `packages/shared`: typed task/context contracts, URL matcher, independent focus engine.
- `docs/technical-plan.md`: original supplied plan.
- `docs/design-reference.md`: verified Figma reference and node IDs.

## Current status

Implemented: workspace tooling, desktop starter window, extension build pipeline,
shared types, conservative URL matching, focus decisions, and focus-engine tests.

Next: authenticated browser-context communication POC → floating desktop bubbles →
local JSON task persistence and management → Figma UI and animations → demo verification.
Files marked TODO are deliberate integration points, not working MVP features.
The starter screen is a development placeholder.

The WebSocket milestone must bind to 127.0.0.1, authenticate with a random local
pairing token, validate messages, handle MV3 reconnects/heartbeat, and return to
NORMAL on stale or disconnected context. Keep tokens out of renderer bundles
and version control. Persist task data in Electron’s userData directory.

## Version control

Local Git repository on `main`. No GitHub repository or remote is configured.
Electron-builder is included for a later packaging milestone; installers,
macOS signing, and notarization are not configured yet.
