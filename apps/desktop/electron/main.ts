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
  applySettings,
  pauseSettings,
  changeGroup,
  reorder,
  isPaused,
  bubbleSize,
  layoutBubbles,
  DEMO_SPEED,
  type AppState,
  type Task,
  type Settings,
  type PauseChoice,
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
    tasks: state.tasks.map((t) => ({ ...t, growthMs: realGrowth.get(t.id) ?? t.growthMs ?? 0 })),
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
  const paused = isPaused(state.settings, now);
  const tasks = state.tasks
    .filter((t) => !t.deletedAt)
    .map((t) => ({
      ...t,
      growthMs: (mode === 'demo' ? demoGrowth : realGrowth).get(t.id) ?? t.growthMs ?? 0,
    }));
  const focus = suspended
    ? 'NORMAL'
    : getFocusState(context?.url ?? null, context?.isFocused ?? false, tasks);
  const matched = focus === 'FOCUS' ? activeTask(tasks) : undefined;
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
  const layout = layoutBubbles(visible, area, obstacles, positions, (t) =>
    state.settings.layoutSide !== 'any'
      ? state.settings.layoutSide
      : state.groups.find((g) => g.id === t.groupId)?.side || 'any',
  );
  full = layout.full;
  for (const p of layout.items) positions.set(p.id, p);
  const viewed = tasks.map((t) => {
    const p = layout.items.find((p) => p.id === t.id);
    return p ? { ...t, size: p.size, position: { x: p.x, y: p.y } } : t;
  });
  return {
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
  if (state.focus === 'FOCUS') {
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
  const saved = repository.state.settings.panelPosition;
  const x = Math.round(
      Math.max(
        area.x,
        Math.min(saved?.x ?? area.x + (area.width - 376) / 2, area.x + area.width - 376),
      ),
    ),
    y = Math.round(
      Math.max(area.y, Math.min(saved?.y ?? area.y + 120, area.y + area.height - 250)),
    );
  const webPreferences = {
    preload: join(__dirname, '../preload/preload.cjs'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  };
  mainWindow = new BrowserWindow({
    x,
    y,
    width: 376,
    height: 330,
    minWidth: 376,
    maxWidth: 376,
    transparent: true,
    frame: false,
    hasShadow: false,
    alwaysOnTop: true,
    resizable: false,
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
  mainWindow.on('moved', () => {
    if (quitting || !mainWindow) return;
    const [x, y] = mainWindow.getPosition();
    void repository
      .mutateState((s) => ({ ...s, settings: { ...s.settings, panelPosition: { x, y } } }))
      .catch(() => {});
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
    const taskId = bubbles.taskFor(e.sender);
    return !panelOnly && Boolean(taskId) && (id === undefined || id === taskId);
  }
  function authorize(e: Electron.IpcMainInvokeEvent, id?: string, panelOnly = false) {
    if (!allowed(e, id, panelOnly)) throw new Error('Untrusted window');
  }
  ipcMain.handle('bubble:viewport', (e) => {
    authorize(e);
    return bubbles.viewport(e.sender);
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
    positions.delete(id);
    await save((s) => editTask(s, id, input));
    notify('Bubble updated.');
    publish();
  });
  ipcMain.handle('task:act', async (e, id, action: TaskAction) => {
    authorize(e, id);
    if (focused?.id === id && (action === 'complete' || action === 'delete')) await finishFocus();
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
        action === 'delete' ? id : undefined,
      );
    }
    publish();
  });
  ipcMain.handle('task:open', async (e, id) => {
    authorize(e, id);
    const task = repository.tasks.find((t) => t.id === id && !t.deletedAt);
    if (!task) return;
    if (task.url) {
      new URL(task.url);
      await shell.openExternal(task.url);
    } else {
      await save((s) => taskAction(s, id, 'complete', Date.now(), randomUUID()));
      notify('Popped. Nice work!');
      publish();
    }
  });
  ipcMain.handle('task:edit', async (e, id) => {
    authorize(e, id);
    await openEditor(id);
  });
  ipcMain.handle('pairing:get', (e) => {
    authorize(e, undefined, true);
    return { token, port: BRIDGE_PORT };
  });
  ipcMain.handle('settings:set', async (e, input: Partial<Settings>) => {
    authorize(e, undefined, true);
    await save((s) => ({ ...s, settings: applySettings(s.settings, input) }));
  });
  ipcMain.handle('pause:set', async (e, choice: PauseChoice) => {
    authorize(e, undefined, true);
    await save((s) => ({ ...s, settings: pauseSettings(s.settings, choice, Date.now()) }));
    notify(
      choice === 'resume' ? 'Bubbles growing again.' : 'Growth paused. Bubbles stay in sight.',
    );
    publish();
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
    positions.clear();
    await save((s) => changeGroup(s, action, input, randomUUID()));
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
    await save((s) => undoDelete(s, id));
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
  ipcMain.on('panel:resize', (e, height: number) => {
    if (!allowed(e, undefined, true) || !Number.isFinite(height) || !mainWindow) return;
    const area = screen.getDisplayMatching(mainWindow.getBounds()).workArea;
    const h = Math.min(area.height - 20, Math.max(200, Math.ceil(height)));
    const [x, y] = mainWindow.getPosition();
    mainWindow.setBounds({
      x,
      y: Math.max(area.y, Math.min(y, area.y + area.height - h)),
      height: h,
    });
  });
  ipcMain.on('bubble:drag', (e, phase, x, y) => {
    if (allowed(e) && ['start', 'move', 'end'].includes(phase)) bubbles.drag(e.sender, phase, x, y);
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
      token = await repository.token();
      for (const t of repository.tasks) realGrowth.set(t.id, t.growthMs || 0);
      bubbles = new BubbleWindows((id, position) => {
        positions.delete(id);
        void save((s) => ({
          ...s,
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, position } : t)),
        })).catch(() => {});
      });
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
      );
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
          isPaused(state.settings, now) ||
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
