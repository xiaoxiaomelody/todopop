import { app, BrowserWindow, ipcMain, shell, Menu, screen, dialog } from 'electron';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  getFocusState,
  urlsMatch,
  validateTaskInput,
  type BrowserContext,
  type Snapshot,
  type TaskAction,
} from '@todopop/shared';
import { TaskRepository } from './storage';
import { BubbleWindows, loadRenderer, lockNavigation } from './windowManager';
import { startBrowserBridge, BRIDGE_PORT } from './websocketServer';

app.setName('TODOPOP');
app.setPath('userData', process.env.TODOPOP_DATA_DIR || join(app.getPath('appData'), 'TODOPOP'));
const locked = app.requestSingleInstanceLock();
if (!locked) app.quit();
let mainWindow: BrowserWindow | null = null;
let repository: TaskRepository;
let bubbles: BubbleWindows;
let context: BrowserContext | null = null;
let connected = false;
let error: string | null = null;
let token = '';
let quitting = false;
let bridge: ReturnType<typeof startBrowserBridge> | null = null;
let tick: ReturnType<typeof setInterval>;
function snapshot(): Snapshot {
  const tasks = repository.tasks;
  const focus = getFocusState(context?.url ?? null, context?.isFocused ?? false, tasks);
  return {
    tasks,
    focus,
    connected,
    error: error || repository.warning,
    matchedTask:
      focus === 'FOCUS'
        ? (tasks.find((t) => !t.completed && t.url && urlsMatch(context!.url!, t.url))?.title ??
          null)
        : null,
  };
}
function publish() {
  if (quitting) return;
  const state = snapshot();
  bubbles.sync(state.tasks, state.focus);
  for (const win of BrowserWindow.getAllWindows())
    if (!win.isDestroyed() && !win.webContents.isLoading())
      win.webContents.send('state:changed', state);
}
function showPanel() {
  mainWindow?.show();
  mainWindow?.focus();
}
async function createPanel() {
  const area = screen.getPrimaryDisplay().workArea;
  mainWindow = new BrowserWindow({
    x: Math.round(area.x + (area.width - 376) / 2),
    y: area.y + 120,
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
    webPreferences: {
      preload: join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  lockNavigation(mainWindow);
  mainWindow.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
  mainWindow.once('ready-to-show', showPanel);
  await loadRenderer(mainWindow);
}
function registerIPC() {
  function isAuthorized(
    event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent,
    id?: string,
    panelOnly = false,
  ): boolean {
    // Native mouse messages can arrive after their bubble has been removed.
    // Reject stale senders without throwing from fire-and-forget IPC listeners.
    if (
      quitting ||
      event.sender.isDestroyed() ||
      !event.senderFrame ||
      event.senderFrame !== event.sender.mainFrame
    )
      return false;
    if (mainWindow && !mainWindow.isDestroyed() && event.sender.id === mainWindow.webContents.id)
      return true;
    const taskId = bubbles.taskFor(event.sender);
    return !panelOnly && Boolean(taskId) && (id === undefined || taskId === id);
  }
  function authorized(
    event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent,
    id?: string,
    panelOnly = false,
  ) {
    if (!isAuthorized(event, id, panelOnly)) throw new Error('Untrusted window.');
  }
  const save = async (update: Parameters<TaskRepository['mutate']>[0]) => {
    try {
      await repository.mutate(update);
      error = null;
      publish();
    } catch (e) {
      error = 'Unable to save tasks. Check local disk permissions and space.';
      publish();
      throw e;
    }
  };
  ipcMain.handle('state:get', (e) => {
    authorized(e);
    return snapshot();
  });
  ipcMain.handle('task:create', async (e, input: unknown) => {
    authorized(e, undefined, true);
    const task = validateTaskInput(input);
    await save((tasks) => {
      if (tasks.length >= 1000 || tasks.filter((t) => !t.completed).length >= 40)
        throw new Error('Limit reached: keep at most 40 floating tasks.');
      return [...tasks, { ...task, id: randomUUID(), createdAt: Date.now(), completed: false }];
    });
  });
  ipcMain.handle('task:update', async (e, id: string, input: unknown) => {
    authorized(e, undefined, true);
    const task = validateTaskInput(input);
    await save((tasks) => tasks.map((t) => (t.id === id ? { ...t, ...task } : t)));
  });
  ipcMain.handle('task:act', async (e, id: string, action: TaskAction) => {
    authorized(e, id);
    if (!['complete', 'restore', 'delete', 'snooze'].includes(action))
      throw new Error('Invalid action.');
    await save((tasks) =>
      action === 'delete'
        ? tasks.filter((t) => t.id !== id)
        : tasks.map((t) =>
            t.id !== id
              ? t
              : action === 'snooze'
                ? { ...t, snoozedUntil: Date.now() + 10 * 60000 }
                : {
                    ...t,
                    completed: action === 'complete',
                    completedAt: action === 'complete' ? Date.now() : undefined,
                    snoozedUntil: undefined,
                  },
          ),
    );
  });
  ipcMain.handle('task:open', async (e, id: string) => {
    authorized(e, id);
    const task = repository.tasks.find((t) => t.id === id);
    if (task?.url) {
      const input = validateTaskInput(task);
      await shell.openExternal(input.url!);
    } else {
      showPanel();
      mainWindow?.webContents.send('task:edit', id);
    }
  });
  ipcMain.handle('task:edit', (e, id: string) => {
    authorized(e, id);
    showPanel();
    mainWindow?.webContents.send('task:edit', id);
  });
  ipcMain.handle('pairing:get', (e) => {
    authorized(e, undefined, true);
    return { token, port: BRIDGE_PORT };
  });
  ipcMain.on('panel:hide', (e) => {
    if (!isAuthorized(e, undefined, true)) return;
    mainWindow?.hide();
  });
  ipcMain.on('panel:resize', (e, height: number) => {
    if (!isAuthorized(e, undefined, true)) return;
    if (!Number.isFinite(height) || !mainWindow) return;
    const area = screen.getDisplayMatching(mainWindow.getBounds()).workArea;
    const h = Math.min(area.height - 20, Math.max(200, Math.ceil(height)));
    const [x, y] = mainWindow.getPosition();
    mainWindow.setBounds({
      x,
      y: Math.max(area.y, Math.min(y, area.y + area.height - h)),
      height: h,
    });
  });
  ipcMain.on('bubble:drag', (e, phase: string, x: number, y: number) => {
    if (!isAuthorized(e)) return;
    if (['start', 'move', 'end'].includes(phase)) bubbles.drag(e.sender, phase, x, y);
  });
  ipcMain.on('bubble:hit', (e, hit: boolean) => {
    if (!isAuthorized(e)) return;
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
      bubbles = new BubbleWindows((id, position) => {
        void repository
          .mutate((tasks) => tasks.map((t) => (t.id === id ? { ...t, position } : t)))
          .catch(() => {
            error = 'Unable to save bubble position.';
            publish();
          });
      });
      registerIPC();
      await createPanel();
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
      publish();
      tick = setInterval(publish, 1000);
      app.on('activate', showPanel);
      app.on('second-instance', showPanel);
    })
    .catch((e) => {
      dialog.showErrorBox('TODOPOP could not start', String(e));
      app.quit();
    });
app.on('before-quit', () => {
  quitting = true;
  if (tick) clearInterval(tick);
  bridge?.close();
});
