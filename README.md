# TODOPOP

**Your tasks disappear when you’re working on them, and reappear when you’re not.**

A macOS-first local desktop prototype built from the supplied technical plan and [Figma prototype](https://www.figma.com/design/51bGy6oFsJV6YJa9jvBKIT/TODOPOP).

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

The fixed TODOPOP wordmark has three interactive Os: **Blow a bubble**, **Popped**, and **Tint & Group**. Hover or keyboard-focus an O to see its symbol and tooltip.

- Single click a linked bubble to open its URL; single click an unlinked bubble to enter a local large-text billboard. Clicks wait 350 ms to distinguish double clicks.
- Double click a bubble to edit its name, URL, urgency and group; right click to Pop. There are no attached bubble buttons. You can undo completion from the control bar.
- Drag a bubble to reposition it. In Tint & Group, select a group to highlight it, then drag its dedicated handle to move all members together. Manual group placement survives restart; Line up or Shuffle releases it.
- Billboard works offline without Chrome. **Back / Esc** leaves the task unfinished; **Pop · Done** completes it. Browser context cannot close a local session.
- The **?** button reopens the interactive tutorial. Practice uses temporary examples, not real tasks.

The control bar stays near the top of the primary display. **⌘⇧Space** or the Dock reopens it if needed. Popped tasks can be bubbled again as a fresh round without removing history.

## Connect Chrome

1. Run `npm run build` to generate the extension, if you have not built it yet.
2. In Chrome, open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select this repository’s `apps/chrome-extension/dist` folder.
4. In the desktop panel, click the connection dot, then **Copy code**.
5. Click the TODOPOP extension in Chrome, paste the code, and connect.

A linked task page in the foreground activates automatic Focus Mode and hides **all** normal bubbles and the panel.
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
  chrome-extension/ Manifest V3 worker, reconnect manager, independent pairing window
packages/
  shared/           Task/context types, validation, growth, layout, history, domain commands
  ui/               Shared Figma logo, Unbounded, theme tokens and React controls
docs/
  technical-plan.md Original supplied plan
  design-reference.md Design decisions and source nodes
  testing.md        Validation and live-demo checklist
scripts/
  e2e.mjs           Real Electron + Chromium integration test
```

Electron main owns task data and validates every renderer mutation. Writes are
serialized and saved through an atomic rename. On macOS, tasks and the pairing
token live in `~/Library/Application Support/TODOPOP/`; the v2 `state.json` contains
tasks, groups, settings and history, with automatic migration/backups of old `tasks.json`; no credentials belong in
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

## Growth and scope

The default Real speed uses logical display units: Now! grows about 37.8 visible
pixels every two minutes, Today half as fast, Soon a quarter, and Remind stays small.
This is a logical centimetre reference, not a physical monitor calibration.
Demo · 60× uses a separate temporary clock and returns to real sizes when disabled.
Pause Growing was removed. Local/browser focus, sleep and 95% screen coverage stop growth automatically; legacy snoozed tasks can still be shown again from the task list.
Tasks do not catch up growth while the app is closed or the system sleeps.

Implemented: conditional click/billboard behavior, double-click editing, right-click Pop with ten original Figma droplet assets, completion/deletion Undo, continuous growth, isolated Demo, contact deformation, clipped polygon-union coverage, fixed logo workspace, ring hue/saturation controls, group selection/movement, new-round Rebubble, and week/month receipt history. At 95% visible coverage, growth stops and resumes when space is freed. Oversized native windows are clipped to the work area rather than displaced by macOS.

The shape solver is a bounded radial-contact model, not a volume-preserving fluid simulation. Coverage uses 64-point contours and 1px scanlines, with overlapping areas counted once and screen/UI clipping applied. Primary-display layout is the current supported baseline; Spaces, external displays and extended daily use still need manual review. Phone, backend, Steps, timer bars, sound and URL blocking are excluded. Chrome pairing remains for the hackathon demo; it is not required for local billboard focus.

## Local preview distribution

`npm run package:mac` builds an Apple Silicon preview in `release/` using the pinned
Electron runtime. The preview is ad-hoc signed for local testing, not Developer ID
signed or notarized. It is not a public production release, and currently uses the
default Electron app icon. There is no automatic updater or store submission.

See the [0.2.0 implementation report](docs/implementation-report-0.2.zh-CN.md) for current changes and manual checks. Older reports are historical snapshots.

See [progress report](docs/progress-report.zh-CN.md), [test details](docs/testing-details.zh-CN.md),
[manual review](docs/manual-review.zh-CN.md) and [current decisions](docs/product-decisions.zh-CN.md).
Git is local on `main`; no remote repository is configured.
