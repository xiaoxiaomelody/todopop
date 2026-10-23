下面这份是专门针对 TODOPOP Hackathon MVP 的技术方案，可以直接发给队友作为开发文档。

我会以 48 小时 Hackathon、2–4 人团队、macOS 优先 为假设。核心原则是：先实现完整的桌面交互体验，不为了未来上架 App Store 而增加当前开发难度。

# TODOPOP — Hackathon Technical Plan

**Project:** TODOPOP\
**Platform:** macOS Desktop + Google Chrome\
**Priority:** Working prototype, visual polish, reliable live demo\
**Target:** 48-hour Hackathon

## 1. Product Vision

**TODOPOP — Your tasks disappear when you're working on them, and reappear when you're not.**

TODOPOP is an intrusive yet playful desktop productivity app.

Instead of requiring users to constantly check a to-do list, TODOPOP brings tasks directly onto their desktop as floating, interactive bubbles.

Each task can be associated with a work URL. When the user navigates to that page, TODOPOP automatically enters Focus Mode and hides the bubbles.

When the user switches away from that work context, the bubbles return.

### Core User Flow

1. User creates a task with a title, urgency level, and optional URL.
2. A floating bubble appears on their desktop.
3. User clicks the bubble.
4. TODOPOP opens the associated URL in Chrome.
5. When the target page becomes active, the bubbles disappear.
6. When the user navigates away, the bubbles reappear.
7. User can mark the task complete, causing its bubble to pop.

**The key innovation is context-aware task visibility.**

## 2. MVP Scope

### P0 — Must Have

**Task Management**

- Create a task with title, URL, and urgency.
- Display active tasks as floating desktop bubbles.
- Mark a task completed.
- Persist tasks locally.

**Desktop Bubbles**

- Transparent, always-on-top bubble windows.
- Multiple bubbles visible simultaneously.
- Different bubble sizes based on urgency.
- Drag-and-drop repositioning.
- Hover and pop animations.

**Automatic Focus Mode**

- Open the task's URL by clicking its bubble.
- Detect the active Chrome tab's URL.
- Hide bubbles when the current URL matches a task.
- Show bubbles when the user leaves the matching page.
- Hide bubbles again when the user returns.

### P1 — Nice to Have

- Smooth transitions between normal and Focus Mode.
- Snooze task.
- Grace period before bubbles reappear.
- Focus status indicator.
- More elaborate bubble physics and animations.

### Out of Scope

- User authentication.
- Cloud synchronization.
- AI task generation or scheduling.
- Support for every browser.
- Tracking arbitrary desktop application content.
- App Store packaging.
- Full analytics dashboard.
- Mobile support.

## 3. Recommended Tech Stack

| Component           | Technology                        |
| ------------------- | --------------------------------- |
| Desktop framework   | Electron                          |
| UI                  | React + TypeScript                |
| Build tooling       | Vite                              |
| Styling             | Tailwind CSS                      |
| Animations          | Motion for React                  |
| Browser monitoring  | Chrome Extension, Manifest V3     |
| Local communication | WebSocket on localhost            |
| State management    | Zustand                           |
| Storage             | Local JSON initially              |
| Packaging           | electron-builder, if time permits |

### Why Electron?

Electron supports transparent, frameless, always-on-top windows, making it a practical choice for desktop bubbles.

React allows us to translate existing Figma components into functional UI quickly.

The Chrome Extension provides the active browsing context, which Electron cannot reliably obtain directly from Chrome.

**No backend or cloud infrastructure is required for the MVP.**

## 4. System Architecture

The system consists of three main components.

### A. Electron Desktop Application

Responsible for:

- Task management interface.
- Creating and positioning bubble windows.
- Rendering bubble animations.
- Handling mouse interactions.
- Persisting task data.
- Opening external URLs.
- Applying Focus Mode decisions.

Suggested window architecture:

**Main Window**

- Landing page.
- Create task form.
- Current tasks.
- Urgency selection.

**Bubble Windows**

- One small transparent Electron BrowserWindow per visible bubble.
- Always on top.
- Independently draggable.
- Independently animated.
- Hidden when Focus Mode is active.

Use small windows instead of one full-screen overlay to avoid intercepting mouse events across the entire desktop.

### B. Chrome Extension

Responsible for:

- Detecting active Chrome tab changes.
- Detecting navigation within the active tab.
- Reading the current page URL with appropriate browser permissions.
- Detecting when the Chrome window gains or loses focus.
- Sending context updates to Electron.

Important APIs:

- `chrome.tabs.onActivated`
- `chrome.tabs.onUpdated`
- `chrome.windows.onFocusChanged`
- `chrome.tabs.query`
- `chrome.windows.getLastFocused`

The Extension should also send the current context when it first connects, so Electron can synchronize even if an earlier event was missed.

### C. Focus Engine

Responsible for deciding whether to display bubbles based on the user's current work context.

Input:

- Current browser URL.
- Whether Chrome is the foreground application/window.
- List of incomplete tasks and their associated URLs.

Output:

- `NORMAL`: Show task bubbles.
- `FOCUS`: Hide task bubbles.

The Focus Engine should be independent from the UI implementation.

## 5. Communication Design

For the Hackathon, use a local WebSocket connection between the Chrome Extension and the Electron main process.

Electron runs a WebSocket server bound to `127.0.0.1`.

The Chrome Extension connects to that server and sends updates whenever the active browser context changes.

### Example Message

```
{
  "type": "CONTEXT_CHANGED",
  "browser": "chrome",
  "isFocused": true,
  "url": "https://docs.google.com/document/d/example/edit"
}
```

Electron receives the message and evaluates Focus Mode.

For the prototype, run both components locally and allow the Extension to reconnect if the connection closes.

Use a randomly generated local authentication token, validate incoming message types, and limit connections to localhost. Do not transmit browsing history to any external server.

A Chrome Manifest V3 extension service worker can be suspended, so the connection manager must handle disconnections and restore the current browser state when reconnecting.

## 6. Focus Mode Logic

### State Definition

```
type FocusState = "NORMAL" | "FOCUS";

type Task = {
  id: string;
  title: string;
  url?: string;
  urgency: 1 | 2 | 3 | 4;
  completed: boolean;
};
```

### Matching Rules

For MVP, use exact or carefully normalized URL matching.

For example:

- Ignore URL fragments where appropriate.
- Allow insignificant trailing-slash differences.
- Avoid matching unrelated pages from the same website.
- Match Google Docs by document ID when possible.

Do not use unrestricted URL prefix matching.

### Focus Decision

```
function getFocusState(
  activeUrl: string | null,
  chromeFocused: boolean,
  tasks: Task[]
): FocusState {
  if (!chromeFocused || !activeUrl) {
    return "NORMAL";
  }

  const matched = tasks.some(task =>
    !task.completed &&
    Boolean(task.url) &&
    urlsMatch(activeUrl, task.url!)
  );

  return matched ? "FOCUS" : "NORMAL";
}
```

### Focus Mode Behavior

**Normal → Focus**

1. Active URL matches an incomplete task.
2. Focus Engine emits `FOCUS`.
3. Electron hides all bubble windows.

**Focus → Normal**

1. Active URL no longer matches any incomplete task, or Chrome loses foreground focus.
2. Focus Engine emits `NORMAL`.
3. Electron restores the bubbles without stealing focus.

**Focus → Focus**

1. User navigates among recognized work pages.
2. Bubbles remain hidden.

### Important Edge Cases

- Chrome is open but not the foreground App.
- Chrome has multiple windows.
- The current tab changes without a page reload.
- Chrome Extension reconnects.
- The user closes the task's browser tab.
- User completes the focused task.
- Two tasks share the same URL.

When the active context cannot be determined reliably, default to Normal Mode rather than silently keeping Focus Mode enabled.

For the first prototype, every incomplete task can be associated with one URL.

## 7. Bubble Window Implementation

Use Electron `BrowserWindow` with:

- `transparent: true`
- `frame: false`
- `alwaysOnTop: true`
- `hasShadow: false`
- `skipTaskbar: true`
- `showInactive()` when restoring windows, to avoid stealing focus.

On macOS, support multiple desktop Spaces where practical.

Each window renders a React Bubble component.

### Bubble Properties

- Task title.
- Urgency level.
- Bubble size.
- Position.
- Visual state.

### Bubble States

- Idle.
- Hover.
- Dragging.
- Popping.
- Hidden.

Urgency controls the initial bubble size.

Suggested mapping:

| Urgency | Size |
| ------- | ---- |
| 1       | S    |
| 2       | M    |
| 3       | L    |
| 4       | XL   |

### Interactions

**Click:** Open associated task URL.

**Drag:** Move bubble around the desktop.

**Mark complete:** Trigger pop animation and remove the corresponding bubble.

For completion, use an explicit button or secondary interaction; a simple click should not accidentally mark a task complete.

## 8. Suggested Project Structure

```
todopop/
│
├── apps/
│   ├── desktop/
│   │   ├── electron/
│   │   │   ├── main.ts
│   │   │   ├── preload.ts
│   │   │   ├── windowManager.ts
│   │   │   └── websocketServer.ts
│   │   │
│   │   └── src/
│   │       ├── components/
│   │       │   ├── Bubble.tsx
│   │       │   ├── TaskForm.tsx
│   │       │   └── TaskList.tsx
│   │       ├── pages/
│   │       │   ├── Landing.tsx
│   │       │   └── BubbleOverlay.tsx
│   │       └── store/
│   │           └── taskStore.ts
│   │
│   └── chrome-extension/
│       ├── manifest.json
│       ├── background.ts
│       └── connection.ts
│
└── packages/
    └── shared/
        ├── types.ts
        ├── urlMatcher.ts
        └── focusEngine.ts
```

Keeping the Focus Engine and URL matcher in a shared module allows both components to use consistent task and context definitions.

## 9. Development Timeline

### Phase 1 — Foundation (Hours 0–8)

**Goal: Working floating Bubble**

- Initialize Electron + React application.
- Create a transparent, always-on-top window.
- Render the first Bubble.
- Implement basic drag interaction.
- Implement click-to-open URL.

**Deliverable:** A functional Bubble floating above Chrome.

### Phase 2 — Task Experience (Hours 8–18)

**Goal: Working to-do system**

- Implement task creation.
- Add URL field.
- Implement urgency-to-size mapping.
- Render multiple bubbles.
- Implement task completion and pop animation.
- Save tasks locally.

**Deliverable:** Users can create, manage, and complete visual tasks.

### Phase 3 — Automatic Focus Mode (Hours 18–30)

**Goal: Complete the main product interaction**

- Create Chrome Extension.
- Listen to active-tab and Chrome focus events.
- Connect Extension to Electron.
- Implement URL matching.
- Implement automatic bubble visibility.
- Test tab and application switching.

**Deliverable:** Bubbles disappear on matching pages and return when users leave.

### Phase 4 — Polish & Demo (Hours 30–40)

**Goal: Make the experience delightful**

- Refine bubble appearance using Figma.
- Implement smooth visibility transitions.
- Improve bubble positioning.
- Fix window focus issues.
- Add a Focus Mode status indicator.
- Handle reconnect and navigation edge cases.

### Phase 5 — Testing & Presentation (Hours 40–48)

**Goal: Reliable live demonstration**

- Test the complete user flow.
- Prepare a demo with a known Google Docs page.
- Prepare a fallback recording.
- Confirm the app works after restart.
- Rehearse switching between work and distraction contexts.
- Build the final presentation.

## 10. Team Responsibilities

For a four-person team:

| Role                    | Responsibilities                                              |
| ----------------------- | ------------------------------------------------------------- |
| Desktop Engineer        | Electron windows, transparency, positioning, drag             |
| Frontend Engineer       | React UI, bubble animations, Figma implementation             |
| Integration Engineer    | Chrome Extension, WebSocket, Focus Engine                     |
| Product / Design / Demo | User flow, polish, testing, presentation, integration support |

For a smaller team, combine the Desktop and Integration responsibilities while keeping UI development relatively independent.

## 11. Definition of Done

The MVP is successful when all of the following work reliably:

- User creates a task with a URL.
- A bubble appears above Chrome.
- Bubble can be dragged.
- Clicking the bubble opens its associated page.
- Bubble windows disappear while the matching page is active.
- Switching to an unrelated tab restores the bubbles.
- Switching away from Chrome restores the bubbles.
- Returning to the task page hides the bubbles again.
- Marking a task complete triggers a pop animation.
- Completed tasks remain completed after restarting TODOPOP.

**Demo success criterion:** Complete the core workflow live without restarting either Electron or Chrome.

## 12. Risks and Fallbacks

### Risk 1 — Extension communication takes too long

**Fallback:** Build a simplified Chrome Extension demo with a manually configured local connection. If integration still fails, use a controlled demo toggle to illustrate Focus Mode, clearly distinguishing simulated behavior from the working features.

### Risk 2 — Transparent windows behave unexpectedly

**Fallback:** Reduce scope to one or two bubbles, each in a small independent window.

### Risk 3 — URL matching is unreliable

**Fallback:** Support only one exact Google Docs URL for the demo.

### Risk 4 — Animation implementation takes too long

**Fallback:** Prioritize working Focus Mode. Use simple CSS transitions for appearing and disappearing bubbles.

### Risk 5 — Browser background behavior causes stale state

**Fallback:** Re-query the active browser context on connection and foreground changes. Display a temporary disconnected state during development.

## 13. Post-Hackathon Opportunities

After the MVP works, potential extensions include:

- macOS app packaging and distribution.
- Safari Web Extension.
- Multiple URLs per task.
- Native application context detection.
- Time-based reminders.
- More sophisticated bubble physics.
- Workspace-based Focus Mode.
- Optional cloud synchronization.

These are deliberately excluded from the Hackathon-critical path.

---

## Final Product Principle

**TODOPOP should be intrusive when users drift away from their tasks and invisible when they're making progress.**

The Hackathon goal is not to build a complete productivity platform.

It is to demonstrate one compelling interaction:

**Create a task → See a Bubble → Open the work → Bubbles disappear → Get distracted → Bubbles return.**

## 额外的工程建议

我想特别强调两点，因为它们可能决定你们 Hackathon 能不能顺利做完。

第一，不要把 Chrome Extension 留到最后。 这是整个方案里集成风险最高的部分。我建议在第一个开发阶段，就让一个最简单的 Extension 能够把当前 URL 传给 Electron。哪怕暂时没有任何漂亮的 UI，也要先验证通信链路。

Chrome 官方的 [Tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs?utm_source=chatgpt.com) 可以监测 Tab 状态，而 Electron 的 [BrowserWindow API](https://www.electronjs.org/docs/latest/api/browser-window?utm_source=chatgpt.com) 可以管理气泡窗口。

[image](https://www.google.com/s2/favicons?domain=https://www.electronjs.org\&sz=32)

Electron

+1



第二，Hackathon 阶段不需要为了 Mac App Store 重写成 Swift。 Electron 本身已经足够实现你们的核心创意。等拿到第一批真实用户反馈，再决定原生化是否值得。

我最推荐的实际开发顺序是：

先做浏览器通信 POC → 再做 Desktop Bubble → 最后整合 Figma 动画和任务管理。

这样就算时间非常紧，你们仍然能保留最有创新性的部分——自动识别工作上下文的 Focus Mode。