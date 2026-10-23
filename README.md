# TODOPOP

**Your tasks disappear when you’re working on them, and reappear when you’re not.**

A macOS-first desktop MVP built from the supplied technical plan and [Figma prototype](https://www.figma.com/design/51bGy6oFsJV6YJa9jvBKIT/TODOPOP).

## Run locally

Use Node.js 24+ and npm. From this repository:

```sh
npm ci
npm run dev
```

To launch from a production build:

```sh
npm start
```

The floating TODOPOP panel has three sections: **Blow a bubble**, **Floating**, and **Popped**.
Create a task, choose an urgency, and optionally link its work URL. A transparent,
always-on-top window appears for each active task. Drag the bubble to reposition
it; click to open its work page; right-click to edit. Hover reveals snooze, edit,
and explicit completion controls. Completed tasks can be restored from Popped.
Closing the panel tucks it away; click the application in the Dock to reopen it,
or use the TODOPOP menu’s **Show TODOPOP** command.

## Connect Chrome

1. Run `npm run build` to generate the extension, if you have not built it yet.
2. In Chrome, open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select this repository’s `apps/chrome-extension/dist` folder.
4. In the desktop panel, click **Connect**, then **Copy pairing code**.
5. Click the TODOPOP extension in Chrome, paste the code, and connect.

A linked task page in the foreground activates Focus Mode and hides **all** bubbles.
An unrelated page, switching away from Chrome, or losing the extension connection
restores them without stealing focus. Pairing persists across restarts.

Active-tab context travels only to `ws://127.0.0.1:17846`. There is no backend,
cloud synchronization, or browsing-history storage. The extension requires Chrome
120+ so that its reconnect alarm and WebSocket keepalive work consistently.

## Architecture

```text
apps/
  desktop/
    electron/       Main process, local storage, IPC, native windows, WebSocket bridge
    src/            React components, Figma assets, Motion animations, Zustand state
  chrome-extension/ Manifest V3 worker, reconnect manager, pairing popup
packages/
  shared/           Task/context types, input validation, URL matching, focus engine
docs/
  technical-plan.md Original supplied plan
  design-reference.md Design decisions and source nodes
  testing.md        Validation and live-demo checklist
scripts/
  e2e.mjs           Real Electron + Chromium integration test
```

Electron main owns task data and validates every renderer mutation. Writes are
serialized and saved through an atomic rename. On macOS, tasks and the pairing
token live in `~/Library/Application Support/TODOPOP/`; no credentials belong in
this repository. An unreadable task file is preserved in a dated recovery copy
and a visible warning explains what happened. Bubble positions and snooze expiry
are saved with the task.

The bridge requires a random 256-bit pairing token, validates message shapes,
limits payload sizes, and accepts extension origins only. It restores Normal
Mode after a disconnect or 25 seconds without fresh context. The extension sends
fresh context on reconnect, foreground/tab changes, navigation, and every 10 seconds.

## Checks

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run format:check
```

The integration test opens disposable Electron and Chromium profiles and a local
HTTP fixture. It never uses your normal Chrome profile. See [testing notes](docs/testing.md).

## Scope

Implemented: task CRUD, urgency sizes, independent transparent bubbles, drag and
position persistence, hover/pop animations, explicit completion and archive
restore, local JSON persistence, authenticated Chrome pairing, automatic Focus
Mode, reconnect, focus status, predefined groups, and 10-minute snooze.

Figma’s browser backdrop is a stand-in for the user’s desktop; the app renders
real floating windows instead. Time-based bubble growth, custom tint/group
management, advanced physics, other browsers, signed installers, and App Store
packaging are outside this MVP. Electron-builder is available for a later
packaging milestone.

Git is local on `main`; no remote repository is configured.
