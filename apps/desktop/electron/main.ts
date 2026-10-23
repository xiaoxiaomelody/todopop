import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  Menu,
  screen,
  dialog,
  globalShortcut,
  powerMonitor,
} from 'electron';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  getFocusState,
  urlsMatch,
  addTask,
  editTask,
  taskAction,
  rebubble,
  undoDelete,
  undoCompletion,
  visibleCoverage,
  clippedBubbleFrame,
  COVERAGE_LIMIT,
  applySettings,
  changeGroup,
  reorder,
  bubbleSize,
  layoutBubbles,
  DEMO_SPEED,
  type AppState,
  type Task,
  type Settings,
  type GroupChange,
  type Side,
  type BrowserContext,
  type Snapshot,
  type TaskAction,
  type LayoutItem,
} from '@todopop/shared';
import { TaskRepository } from './storage';
import { BubbleWindows, loadRenderer, lockNavigation } from './windowManager';
import { startBrowserBridge, BRIDGE_PORT } from './websocketServer';
const bridgePort =
  process.env.TODOPOP_DATA_DIR && process.env.TODOPOP_TEST_PORT
    ? Number(process.env.TODOPOP_TEST_PORT)
    : BRIDGE_PORT;
app.setName('TODOPOP');
app.setPath('userData', process.env.TODOPOP_DATA_DIR || join(app.getPath('appData'), 'TODOPOP'));
const locked = app.requestSingleInstanceLock();
if (!locked) app.quit();
let mainWindow: BrowserWindow | null = null,
  launcher: BrowserWindow | null = null,
  repository: TaskRepository,
  bubbles: BubbleWindows,
  context: BrowserContext | null = null,
  connected = false,
  error: string | null = null,
  token = '',
  quitting = false,
  exitReady = false,
  panelHidden = false,
  suspended = false;
let bridge: ReturnType<typeof startBrowserBridge> | null = null,
  tick: ReturnType<typeof setInterval>,
  lastTick = Date.now(),
  lastCheckpoint = Date.now();
let mode: 'real' | 'demo' = 'real',
  full = false,
  toast: Snapshot['toast'] = null,
  toastExpires = 0;
const realGrowth = new Map<string, number>(),
  demoGrowth = new Map<string, number>(),
  positions = new Map<string, LayoutItem>();
let panelAnchor: { x: number; y: number } | null = null;
let panelDrag: { x: number; y: number; left: number; top: number } | null = null;
let coverageCache = { key: '', at: 0, value: 0 };
const contours = new Map<string, { size: number; points: { x: number; y: number }[] }>();
let billboardId: string | null = null;
let billboardWindow: BrowserWindow | null = null;
let selectedGroupId: string | null = null;
let groupDrag: {
  ending?: boolean;
  x: number;
  y: number;
  origins: Map<string, { x: number; y: number }>;
} | null = null;
let focused: { id: string; startedAt: number } | null = null;
function activeTask(tasks: Task[]) {
  return tasks.find(
    (t) =>
      !t.completed &&
      !t.deletedAt &&
      t.url &&
      context?.isFocused &&
      urlsMatch(context.url || '', t.url),
  );
}
function withGrowth(state: AppState): AppState {
  return {
    ...state,
    tasks: state.tasks.map((t) => {
      const p = mode === 'real' ? positions.get(t.id) : undefined;
      return {
        ...t,
        growthMs: realGrowth.get(t.id) ?? t.growthMs ?? 0,
        position: p ? { x: p.x, y: p.y } : t.position,
      };
    }),
  };
}
async function finishFocus(now = Date.now()) {
  const ended = focused;
  focused = null;
  if (!ended) return;
  const duration = Math.max(0, now - ended.startedAt);
  if (duration < 100) return;
  await repository.mutateState((state) => {
    const task = state.tasks.find((t) => t.id === ended.id);
    if (!task) return state;
    return {
      ...state,
      tasks: state.tasks.map((t) =>
        t.id === ended.id ? { ...t, focusMs: (t.focusMs || 0) + duration } : t,
      ),
      history: [
        ...state.history,
        {
          id: randomUUID(),
          taskId: task.id,
          kind: 'focus',
          at: now,
          title: task.title,
          urgency: task.urgency,
          groupId: task.groupId,
          durationMs: duration,
        },
      ],
    };
  });
}
function snapshot(): Snapshot {
  const state = repository.state,
    now = Date.now();
  const paused = false;
  const tasks = state.tasks
    .filter((t) => !t.deletedAt)
    .map((t) => ({
      ...t,
      growthMs: (mode === 'demo' ? demoGrowth : realGrowth).get(t.id) ?? t.growthMs ?? 0,
    }));
  const focus = suspended
    ? 'NORMAL'
    : billboardId
      ? 'FOCUS'
      : getFocusState(context?.url ?? null, context?.isFocused ?? false, tasks);
  const matched =
    focus === 'FOCUS'
      ? billboardId
        ? tasks.find((t) => t.id === billboardId && !t.completed)
        : activeTask(tasks)
      : undefined;
  if (focused?.id !== matched?.id) {
    const old = focused;
    focused = null;
    if (old) {
      focused = old;
      void finishFocus(now).catch((e) => {
        error = String(e);
      });
    }
    focused = matched ? { id: matched.id, startedAt: now } : null;
  }
  const area = screen.getPrimaryDisplay().workArea;
  const obstacles = [];
  if (mainWindow && !mainWindow.isDestroyed() && !panelHidden && focus === 'NORMAL')
    obstacles.push(mainWindow.getBounds());
  if (panelHidden && focus === 'NORMAL')
    obstacles.push({
      x: area.x + area.width - 190,
      y: area.y + area.height - 72,
      width: 190,
      height: 72,
    });
  const visible = tasks
    .filter((t) => !t.completed && !(t.snoozedUntil && t.snoozedUntil > now))
    .map((t) => ({ ...t, size: bubbleSize(t) }));
  const layout = layoutBubbles(
    visible,
    area,
    obstacles,
    positions,
    (t) =>
      state.settings.layoutSide !== 'any'
        ? state.settings.layoutSide
        : state.groups.find((g) => g.id === t.groupId)?.side || 'any',
    new Set([
      ...(groupDrag?.origins.keys() || []),
      ...bubbles.draggingIds(),
      ...visible
        .filter(
          (t) =>
            state.settings.layoutSide === 'any' &&
            state.groups.some((g) => g.id === t.groupId && g.positionLocked) &&
            (t.position || positions.has(t.id)),
        )
        .map((t) => t.id),
    ]),
  );

  for (const p of layout.items) positions.set(p.id, p);
  const viewed = tasks.map((t) => {
    const p = layout.items.find((p) => p.id === t.id);
    if (!p) return t;
    const frame = clippedBubbleFrame(p.size, p, area);
    return {
      ...t,
      size: p.size,
      position: { x: p.x, y: p.y },
      renderOffset: { x: p.x - frame.x, y: p.y - frame.y },
      contour: contours.get(t.id)?.size === p.size ? contours.get(t.id)?.points : undefined,
    };
  });
  const coverageKey =
    viewed
      .filter((t) => !t.completed)
      .map((t) => `${t.id}:${t.size}`)
      .join('|') +
    state.settings.layoutSide +
    JSON.stringify(obstacles.map((b) => [b.width, b.height])) +
    JSON.stringify(area);
  if (focus !== 'FOCUS' && (coverageCache.key !== coverageKey || now - coverageCache.at > 250))
    coverageCache = {
      key: coverageKey,
      at: now,
      value: visibleCoverage(
        viewed.filter((t) => !t.completed && !(t.snoozedUntil && t.snoozedUntil > now)),
        area,
        obstacles,
      ),
    };
  const coverage = focus === 'FOCUS' ? 0 : coverageCache.value;
  full = coverage >= COVERAGE_LIMIT;
  return {
    billboardId,
    obstacles,
    selectedGroupId,
    coverage,
    tasks: viewed,
    groups: state.groups,
    history: state.history,
    settings: state.settings,
    focus,
    connected,
    error: error || repository.warning,
    matchedTask: matched?.title ?? null,
    paused,
    full,
    growthMode: mode,
    toast,
  };
}
function notify(message: string, undoId?: string) {
  toast = { message, undoId };
  toastExpires = Date.now() + 8000;
}
function publish() {
  if (quitting) return;
  const state = snapshot();
  bridge?.appearance(state.settings.tint);
  bubbles.sync(state.tasks, state.focus);
  if (
    editor &&
    !editor.isDestroyed() &&
    !state.tasks.some((t) => t.id === editingId && !t.completed)
  )
    editor.close();
  if (state.focus === 'FOCUS' && !billboardId) {
    mainWindow?.hide();
    launcher?.hide();
  } else if (panelHidden) {
    if (!launcher?.isVisible()) launcher?.showInactive();
  } else {
    launcher?.hide();
    if (mainWindow && !mainWindow.isVisible()) mainWindow.showInactive();
  }
  for (const win of BrowserWindow.getAllWindows())
    if (!win.isDestroyed() && !win.webContents.isLoading())
      win.webContents.send('state:changed', state);
}
function showPanel() {
  if (quitting || !mainWindow || mainWindow.isDestroyed()) return;
  panelHidden = false;
  mainWindow?.show();
  mainWindow?.focus();
  launcher?.hide();
  publish();
}
async function save(transform: (state: AppState) => AppState) {
  try {
    await repository.mutateState((state) => transform(withGrowth(state)));
    error = null;
    publish();
  } catch (e) {
    error = e instanceof Error ? e.message : 'Could not save changes';
    publish();
    throw e;
  }
}
async function createWindows() {
  const area = screen.getPrimaryDisplay().workArea;
  const saved = repository.state.settings.panelPosition || {
    x: area.x + (area.width - 300) / 2,
    y: area.y + 12,
  };
  const x = Math.round(Math.max(area.x, Math.min(saved.x, area.x + area.width - 300))),
    y = Math.round(Math.max(area.y, Math.min(saved.y, area.y + area.height - 80)));
  panelAnchor = { x, y };
  const webPreferences = {
    preload: join(__dirname, '../preload/preload.cjs'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  };
  mainWindow = new BrowserWindow({
    x,
    y,
    width: 300,
    height: 96,
    minWidth: 300,
    maxWidth: 376,
    transparent: true,
    frame: false,
    hasShadow: false,
    alwaysOnTop: true,
    resizable: false,
    movable: true,
    backgroundColor: '#00000000',
    show: false,
    title: 'TODOPOP',
    webPreferences,
  });
  mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
  lockNavigation(mainWindow);
  mainWindow.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      panelHidden = true;
      mainWindow?.hide();
      publish();
    }
  });
  mainWindow.once('ready-to-show', showPanel);
  await loadRenderer(mainWindow);
  if (quitting) return;
  launcher = new BrowserWindow({
    x: area.x + area.width - 190,
    y: area.y + area.height - 72,
    width: 190,
    height: 72,
    transparent: true,
    frame: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences,
  });
  launcher.setAlwaysOnTop(true, 'pop-up-menu');
  lockNavigation(launcher);
  launcher.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  await loadRenderer(launcher, undefined, 'launcher');
}
let editor: BrowserWindow | null = null;
let editingId: string | null = null;
async function openEditor(id: string) {
  if (!repository.tasks.some((t) => t.id === id && !t.deletedAt && !t.completed)) return;
  if (editor && !editor.isDestroyed() && editingId === id) {
    editor.show();
    editor.focus();
    return;
  }
  editor?.destroy();
  editingId = id;
  const bubble = bubbles.windows.get(id);
  const bounds = bubble?.getBounds() || mainWindow!.getBounds();
  const area = screen.getDisplayMatching(bounds).workArea,
    width = 364,
    height = Math.min(610, area.height - 20);
  let x = Math.round(bounds.x + bounds.width * 0.8);
  if (x + width > area.x + area.width) x = Math.round(bounds.x - width + 50);
  x = Math.max(area.x + 8, Math.min(x, area.x + area.width - width - 8));
  const y = Math.max(
    area.y + 8,
    Math.min(Math.round(bounds.y + bounds.height * 0.2), area.y + area.height - height - 8),
  );
  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    show: false,
    backgroundColor: '#00000000',
    title: 'Edit bubble',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  editor = win;
  win.setAlwaysOnTop(true, 'pop-up-menu');
  lockNavigation(win);
  win.on('closed', () => {
    if (editor === win) {
      editor = null;
      editingId = null;
    }
  });
  win.once('ready-to-show', () => {
    if (!quitting && !win.isDestroyed()) {
      win.show();
      win.focus();
    }
  });
  await loadRenderer(win, undefined, `edit=${encodeURIComponent(id)}`);
}

async function leaveBillboard() {
  billboardId = null;
  const win = billboardWindow;
  billboardWindow = null;
  if (win && !win.isDestroyed()) win.destroy();
  await finishFocus();
  publish();
}
async function openBillboard(id: string) {
  if (billboardId === id && billboardWindow && !billboardWindow.isDestroyed()) {
    billboardWindow.show();
    return;
  }
  await leaveBillboard();
  billboardId = id;
  const area = screen.getPrimaryDisplay().workArea;
  const width = Math.min(840, area.width - 32),
    height = Math.min(560, area.height - 48);
  const win = new BrowserWindow({
    x: Math.round(area.x + (area.width - width) / 2),
    y: Math.round(area.y + (area.height - height) / 2),
    width,
    height,
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    show: false,
    title: 'TODOPOP · In the bubble',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  billboardWindow = win;
  win.setAlwaysOnTop(true, 'pop-up-menu');
  lockNavigation(win);
  win.on('close', (e) => {
    if (!quitting && billboardWindow === win) {
      e.preventDefault();
      void leaveBillboard();
    }
  });
  win.once('ready-to-show', () => {
    if (!win.isDestroyed() && billboardId === id) win.show();
  });
  publish();
  try {
    await loadRenderer(win, undefined, `billboard=${encodeURIComponent(id)}`);
  } catch (e) {
    if (!quitting) {
      await leaveBillboard();
      throw e;
    }
  }
}

function registerIPC() {
  function allowed(
    e: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent,
    id?: string,
    panelOnly = false,
  ) {
    if (
      quitting ||
      e.sender.isDestroyed() ||
      !e.senderFrame ||
      e.senderFrame !== e.sender.mainFrame
    )
      return false;
    if (mainWindow && !mainWindow.isDestroyed() && e.sender.id === mainWindow.webContents.id)
      return true;
    if (!panelOnly && editor && !editor.isDestroyed() && e.sender.id === editor.webContents.id)
      return id === undefined || id === editingId;
    if (
      !panelOnly &&
      billboardWindow &&
      !billboardWindow.isDestroyed() &&
      e.sender.id === billboardWindow.webContents.id
    )
      return id === undefined || id === billboardId;
    const taskId = bubbles.taskFor(e.sender);
    return !panelOnly && Boolean(taskId) && (id === undefined || id === taskId);
  }
  function authorize(e: Electron.IpcMainInvokeEvent, id?: string, panelOnly = false) {
    if (!allowed(e, id, panelOnly)) throw new Error('Untrusted window');
  }
  ipcMain.handle('focus:exit', async (e) => {
    authorize(e);
    await leaveBillboard();
  });
  ipcMain.handle('groups:select', (e, id) => {
    authorize(e, undefined, true);
    if (id !== null && !repository.state.groups.some((g) => g.id === id))
      throw new Error('Unknown group');
    if (groupDrag && !groupDrag.ending && id !== selectedGroupId) {
      for (const [taskId, p] of groupDrag.origins) {
        const old = positions.get(taskId);
        if (old) positions.set(taskId, { ...old, ...p });
      }
      groupDrag = null;
    }
    selectedGroupId = id;
    publish();
  });
  ipcMain.on('groups:drag', (e, phase, x, y, groupId?: string) => {
    if (!allowed(e, undefined, true) || !Number.isFinite(x) || !Number.isFinite(y)) return;
    if (phase === 'start' && groupId !== undefined) {
      if (typeof groupId !== 'string' || !repository.state.groups.some((g) => g.id === groupId))
        return;
      selectedGroupId = groupId;
    }
    if (!selectedGroupId) return;
    if (phase === 'start') {
      const origins = new Map<string, { x: number; y: number }>();
      for (const t of repository.tasks.filter(
        (t) => t.groupId === selectedGroupId && !t.completed && !t.deletedAt,
      )) {
        const w = bubbles.windows.get(t.id);
        if (w && !w.isDestroyed()) {
          const b = w.getBounds();
          const p = positions.get(t.id);
          origins.set(t.id, { x: p?.x ?? b.x, y: p?.y ?? b.y });
        }
      }
      groupDrag = { x, y, origins };
    } else if (phase === 'move' && groupDrag && !groupDrag.ending) {
      const area = screen.getPrimaryDisplay().workArea;
      let dx = x - groupDrag.x,
        dy = y - groupDrag.y;
      let loX = -Infinity,
        hiX = Infinity,
        loY = -Infinity,
        hiY = Infinity;
      for (const [id, p] of groupDrag.origins) {
        const size = positions.get(id)?.size || 118;
        loX = Math.max(loX, area.x + 12 - p.x - size * 0.2);
        hiX = Math.min(hiX, area.x + area.width - 12 - p.x - size * 0.8);
        loY = Math.max(loY, area.y + 12 - p.y - size * 0.2);
        hiY = Math.min(hiY, area.y + area.height - 12 - p.y - size * 0.8);
      }
      dx = Math.max(loX, Math.min(dx, hiX));
      dy = Math.max(loY, Math.min(dy, hiY));
      for (const [id, p] of groupDrag.origins) {
        const old = positions.get(id);
        if (old) positions.set(id, { ...old, x: Math.round(p.x + dx), y: Math.round(p.y + dy) });
      }
      publish();
    } else if (phase === 'end' && groupDrag && !groupDrag.ending) {
      const ending = groupDrag,
        groupId = selectedGroupId;
      ending.ending = true;
      const placed = new Map(
        [...ending.origins.keys()].flatMap((id) => {
          const p = positions.get(id);
          return p ? [[id, { x: p.x, y: p.y }] as const] : [];
        }),
      );
      void save((state) => ({
        ...state,
        settings: { ...state.settings, layoutSide: 'any' },
        groups: state.groups.map((g) =>
          g.id === groupId ? { ...g, side: 'any', positionLocked: true } : g,
        ),
        tasks: state.tasks.map((t) =>
          placed.has(t.id) ? { ...t, position: placed.get(t.id) } : t,
        ),
      }))
        .catch(() => {})
        .finally(() => {
          if (groupDrag === ending) groupDrag = null;
          publish();
        });
    }
  });
  ipcMain.handle('state:get', (e) => {
    if (launcher && !launcher.isDestroyed() && e.sender.id === launcher.webContents.id)
      return snapshot();
    authorize(e);
    return snapshot();
  });
  ipcMain.handle('task:create', async (e, input) => {
    authorize(e, undefined, true);
    await save((s) => addTask(s, input, randomUUID(), Date.now()));
    notify('A new bubble is floating.');
    publish();
  });
  ipcMain.handle('task:update', async (e, id, input) => {
    authorize(e, id);
    await save((s) => editTask(s, id, input));
    notify('Bubble updated.');
    publish();
  });
  ipcMain.handle('task:act', async (e, id, action: TaskAction) => {
    authorize(e, id);
    if (billboardId === id && (action === 'complete' || action === 'delete'))
      await leaveBillboard();
    else if (focused?.id === id && (action === 'complete' || action === 'delete'))
      await finishFocus();
    if (action === 'restore') {
      await save((s) => rebubble(s, id, randomUUID(), Date.now()));
      notify('A fresh round. Your history stays.');
    } else {
      await save((s) => taskAction(s, id, action, Date.now(), randomUUID()));
      notify(
        action === 'delete'
          ? 'Bubble deleted.'
          : action === 'wake'
            ? 'Bubble is back.'
            : action === 'snooze'
              ? 'Snoozed for 10 minutes.'
              : 'Popped. Nice work!',
        action === 'delete' || action === 'complete' ? id : undefined,
      );
    }
    publish();
  });
  ipcMain.handle('task:open', async (e, id) => {
    authorize(e, id);
    const task = repository.tasks.find((t) => t.id === id && !t.deletedAt && !t.completed);
    if (!task) return;
    selectedGroupId = null;
    if (task.url) {
      new URL(task.url);
      await shell.openExternal(task.url);
      publish();
    } else {
      await openBillboard(id);
    }
  });
  ipcMain.handle('task:edit', async (e, id) => {
    authorize(e, id);
    await openEditor(id);
  });
  ipcMain.handle('pairing:get', (e) => {
    authorize(e, undefined, true);
    return { token, port: bridgePort };
  });
  ipcMain.handle('settings:set', async (e, input: Partial<Settings>) => {
    authorize(e, undefined, true);
    await save((s) => ({ ...s, settings: applySettings(s.settings, input) }));
  });
  ipcMain.handle('growth:mode', (e, next: 'real' | 'demo') => {
    authorize(e, undefined, true);
    if (!['real', 'demo'].includes(next)) throw new Error('Invalid growth mode');
    mode = next;
    demoGrowth.clear();
    if (next === 'demo')
      for (const t of repository.tasks)
        demoGrowth.set(t.id, realGrowth.get(t.id) ?? t.growthMs ?? 0);
    positions.clear();
    notify(
      next === 'demo' ? 'Demo · 60× preview. Real growth is untouched.' : 'Back to real growth.',
    );
    publish();
  });
  ipcMain.handle('groups:change', async (e, action, input: GroupChange) => {
    authorize(e, undefined, true);
    if (action === 'delete' && input.id === selectedGroupId) selectedGroupId = null;
    if (input.side !== undefined) positions.clear();
    await save((s) => {
      const next = changeGroup(s, action, input, randomUUID());
      return input.side !== undefined
        ? {
            ...next,
            groups: next.groups.map((g) =>
              g.id === input.id ? { ...g, positionLocked: false } : g,
            ),
          }
        : next;
    });
  });
  ipcMain.handle('tasks:reorder', async (e, ids: string[]) => {
    authorize(e, undefined, true);
    await save((s) => reorder(s, ids));
  });
  ipcMain.handle('layout:arrange', async (e, side: Side | 'shuffle') => {
    authorize(e, undefined, true);
    positions.clear();
    await save((s) => ({
      ...s,
      settings: applySettings(s.settings, { layoutSide: side === 'shuffle' ? 'any' : side }),
      groups: s.groups.map((g) => ({ ...g, positionLocked: false })),
      tasks: s.tasks.map((t) => ({ ...t, position: undefined })),
    }));
    if (side === 'shuffle') {
      const area = screen.getPrimaryDisplay().workArea;
      for (const t of repository.tasks) {
        const size = bubbleSize(t);
        positions.set(t.id, {
          id: t.id,
          x: Math.round(area.x + Math.random() * Math.max(1, area.width - size)),
          y: Math.round(area.y + Math.random() * Math.max(1, area.height - size)),
          size,
          side: 'any',
        });
      }
      publish();
    }
  });
  ipcMain.handle('task:undo', async (e, id) => {
    authorize(e, undefined, true);
    await save((s) =>
      s.tasks.find((t) => t.id === id)?.completed ? undoCompletion(s, id) : undoDelete(s, id),
    );
    notify('Bubble restored.');
    publish();
  });
  ipcMain.on('edit:close', (e) => {
    if (editor && !editor.isDestroyed() && e.sender.id === editor.webContents.id) editor.close();
  });
  ipcMain.on('edit:resize', (e, height: number) => {
    if (
      !editor ||
      editor.isDestroyed() ||
      e.sender.id !== editor.webContents.id ||
      !Number.isFinite(height)
    )
      return;
    const area = screen.getDisplayMatching(editor.getBounds()).workArea;
    const h = Math.max(200, Math.min(area.height - 20, Math.ceil(height)));
    const [x, y] = editor.getPosition();
    editor.setBounds({
      x,
      y: Math.max(area.y + 8, Math.min(y, area.y + area.height - h - 8)),
      height: h,
    });
  });
  ipcMain.on('panel:show', (e) => {
    if (launcher && !launcher.isDestroyed() && e.sender.id === launcher.webContents.id) showPanel();
  });
  ipcMain.on('panel:hide', (e) => {
    if (!allowed(e, undefined, true)) return;
    panelHidden = true;
    mainWindow?.hide();
    publish();
  });
  ipcMain.on('panel:resize', (e, height: number, width?: number) => {
    if (!allowed(e, undefined, true) || !Number.isFinite(height) || !mainWindow) return;
    const area = screen.getDisplayMatching(mainWindow.getBounds()).workArea;
    const h = Math.min(area.height - 20, Math.max(68, Math.ceil(height)));
    const w =
      width === undefined
        ? mainWindow.getBounds().width
        : Math.max(300, Math.min(376, Math.ceil(width)));
    if (!Number.isFinite(w)) return;
    const anchor = panelDrag
      ? { x: mainWindow.getBounds().x, y: mainWindow.getBounds().y }
      : panelAnchor || mainWindow.getBounds();
    mainWindow.setBounds({
      x: Math.round(Math.max(area.x, Math.min(anchor.x, area.x + area.width - w))),
      y: Math.round(Math.max(area.y, Math.min(anchor.y, area.y + area.height - h))),
      width: w,
      height: h,
    });
  });
  ipcMain.on('panel:drag', (e, phase, x, y) => {
    if (!allowed(e, undefined, true) || !mainWindow || !Number.isFinite(x) || !Number.isFinite(y))
      return;
    if (phase === 'start') {
      const b = mainWindow.getBounds();
      panelDrag = { x, y, left: b.x, top: b.y };
    } else if (phase === 'move' && panelDrag) {
      const a = screen.getDisplayNearestPoint({ x: Math.round(x), y: Math.round(y) }).workArea,
        b = mainWindow.getBounds();
      mainWindow.setPosition(
        Math.round(
          Math.max(a.x, Math.min(panelDrag.left + x - panelDrag.x, a.x + a.width - b.width)),
        ),
        Math.round(
          Math.max(a.y, Math.min(panelDrag.top + y - panelDrag.y, a.y + a.height - b.height)),
        ),
        false,
      );
      publish();
    } else if (phase === 'end' && panelDrag) {
      panelDrag = null;
      const b = mainWindow.getBounds();
      panelAnchor = { x: b.x, y: b.y };
      void repository
        .mutateState((s) => ({ ...s, settings: { ...s.settings, panelPosition: panelAnchor! } }))
        .catch(() => {
          error = 'Could not save dock position';
          publish();
        });
    }
  });
  ipcMain.on('bubble:drag', (e, phase, x, y) => {
    if (allowed(e) && ['start', 'move', 'end'].includes(phase)) bubbles.drag(e.sender, phase, x, y);
  });
  ipcMain.on('bubble:contour', (e, size, points) => {
    if (!allowed(e)) return;
    const id = bubbles.taskFor(e.sender);
    if (
      !id ||
      !Number.isFinite(size) ||
      size < 1 ||
      size > 20000 ||
      !Array.isArray(points) ||
      points.length < 20 ||
      points.length > 200
    )
      return;
    if (
      points.some(
        (p) =>
          !p ||
          !Number.isFinite(p.x) ||
          !Number.isFinite(p.y) ||
          Math.abs(p.x) > size * 2 ||
          Math.abs(p.y) > size * 2,
      )
    )
      return;
    contours.set(id, { size, points });
  });
  ipcMain.on('bubble:hit', (e, hit: boolean) => {
    if (!allowed(e)) return;
    const win = BrowserWindow.fromWebContents(e.sender);
    if (bubbles.taskFor(e.sender) && typeof hit === 'boolean')
      win?.setIgnoreMouseEvents(!hit, { forward: true });
  });
}
if (locked)
  app
    .whenReady()
    .then(async () => {
      repository = new TaskRepository(app.getPath('userData'));
      await repository.load();
      if (repository.state.settings.interactionVersion !== 2)
        await repository.mutateState((s) => ({
          ...s,
          settings: {
            ...s.settings,
            interactionVersion: 2,
            tutorialDone: false,
            pauseUntil: null,
            pauseIndefinite: false,
          },
        }));
      token = await repository.token();
      for (const t of repository.tasks) realGrowth.set(t.id, t.growthMs || 0);
      bubbles = new BubbleWindows(
        (id, position) => {
          const old = positions.get(id);
          if (old) positions.set(id, { ...old, ...position });
          void save((s) => ({
            ...s,
            tasks: s.tasks.map((t) => (t.id === id ? { ...t, position } : t)),
          })).catch(() => {});
        },
        (id, position) => {
          const old = positions.get(id);
          if (old) positions.set(id, { ...old, ...position });
          publish();
        },
      );
      registerIPC();
      await createWindows();
      if (quitting) return;
      Menu.setApplicationMenu(
        Menu.buildFromTemplate([
          {
            label: 'TODOPOP',
            submenu: [
              { label: 'Show TODOPOP', accelerator: 'CmdOrCtrl+Shift+T', click: showPanel },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
          { role: 'editMenu' },
          {
            label: 'View',
            submenu: [{ label: 'Show panel', click: showPanel }, { role: 'toggleDevTools' }],
          },
        ]),
      );
      globalShortcut.register('CommandOrControl+Shift+Space', showPanel);
      bridge = startBrowserBridge(
        token,
        (next, ready) => {
          context = next;
          connected = ready;
          publish();
        },
        (message) => {
          error = message;
          publish();
        },
        bridgePort,
      );
      screen.on('display-metrics-changed', () => {
        positions.clear();
        publish();
      });
      screen.on('display-removed', () => {
        positions.clear();
        publish();
      });
      powerMonitor.on('suspend', () => {
        suspended = true;
        void finishFocus();
      });
      powerMonitor.on('resume', () => {
        suspended = false;
        context = null;
        lastTick = Date.now();
        publish();
      });
      lastTick = Date.now();
      tick = setInterval(() => {
        const now = Date.now(),
          dt = Math.max(0, Math.min(2000, now - lastTick));
        lastTick = now;
        const state = repository.state;
        const stopped =
          suspended ||
          Boolean(billboardId) ||
          getFocusState(context?.url ?? null, context?.isFocused ?? false, repository.tasks) ===
            'FOCUS' ||
          full;
        if (!stopped)
          for (const t of repository.tasks)
            if (!t.completed && !t.deletedAt && !(t.snoozedUntil && t.snoozedUntil > now)) {
              const map = mode === 'demo' ? demoGrowth : realGrowth;
              map.set(
                t.id,
                (map.get(t.id) ?? t.growthMs ?? 0) + dt * (mode === 'demo' ? DEMO_SPEED : 1),
              );
            }
        if (toast && now > toastExpires) toast = null;
        if (now - lastCheckpoint > 15000) {
          lastCheckpoint = now;
          void repository.mutateState(withGrowth).catch(() => {
            error = 'Could not save growth progress';
          });
        }
        publish();
      }, 1000);
      publish();
      app.on('activate', showPanel);
      app.on('second-instance', showPanel);
    })
    .catch((e) => {
      if (quitting) return;
      dialog.showErrorBox('TODOPOP could not start', String(e));
      app.quit();
    });
app.on('before-quit', (e) => {
  if (exitReady || !repository) return;
  e.preventDefault();
  quitting = true;
  clearInterval(tick);
  globalShortcut.unregisterAll();
  bridge?.close();
  void finishFocus()
    .then(() => repository.mutateState(withGrowth))
    .finally(() => {
      exitReady = true;
      // State is flushed; exit directly so a second quit cannot be cancelled by a stale window.
      app.exit(0);
    });
});
