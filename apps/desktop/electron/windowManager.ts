import { BrowserWindow, screen, type WebContents } from 'electron';
import { join } from 'node:path';
import { BUBBLE_SIZE, type Task, type FocusState } from '@todopop/shared';
export function lockNavigation(win: BrowserWindow) {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}
export async function loadRenderer(win: BrowserWindow, taskId?: string, route?: string) {
  const hash = route || (taskId ? `bubble=${encodeURIComponent(taskId)}` : '');
  if (process.env.ELECTRON_RENDERER_URL)
    await win.loadURL(`${process.env.ELECTRON_RENDERER_URL}#${hash}`);
  else await win.loadFile(join(__dirname, '../../dist/index.html'), { hash });
}
export class BubbleWindows {
  readonly windows = new Map<string, BrowserWindow>();
  private ready = new Set<string>();
  private visible = true;
  private closing = new Set<string>();
  private dragState = new Map<number, { x: number; y: number; left: number; top: number }>();
  constructor(private persistPosition: (id: string, position: { x: number; y: number }) => void) {}
  taskFor(sender: WebContents) {
    if (sender.isDestroyed()) return undefined;
    return [...this.windows].find(
      ([, w]) => !w.isDestroyed() && w.webContents.id === sender.id,
    )?.[0];
  }
  viewport(sender: WebContents) {
    const id = this.taskFor(sender);
    const win = id ? this.windows.get(id) : undefined;
    if (!win || win.isDestroyed()) return null;
    const b = win.getBounds();
    const area = screen.getDisplayMatching(b).workArea;
    const x = Math.max(0, area.x - b.x),
      y = Math.max(0, area.y - b.y);
    return {
      x,
      y,
      width: Math.max(0, Math.min(b.width, area.x + area.width - b.x) - x),
      height: Math.max(0, Math.min(b.height, area.y + area.height - b.y) - y),
    };
  }
  sync(tasks: Task[], focus: FocusState) {
    this.visible = focus === 'NORMAL';
    const wanted = tasks.filter(
      (t) => !t.completed && !t.deletedAt && !(t.snoozedUntil && t.snoozedUntil > Date.now()),
    );
    for (const [id, win] of this.windows)
      if (!wanted.some((t) => t.id === id) && !this.closing.has(id)) {
        this.closing.add(id);
        if (!win.isDestroyed()) win.webContents.send('bubble:pop');
        setTimeout(() => {
          this.windows.delete(id);
          this.ready.delete(id);
          this.closing.delete(id);
          if (!win.isDestroyed()) {
            this.dragState.delete(win.webContents.id);
            win.destroy();
          }
        }, 360);
      }
    wanted.forEach((task, index) => {
      let win = this.windows.get(task.id);
      const size = Math.round(task.size || BUBBLE_SIZE[task.urgency]);
      const area = screen.getPrimaryDisplay().workArea;
      const position = task.position || {
        x: area.x + 20 + index * 90,
        y: area.y + 60 + index * 60,
      };
      if (!win || win.isDestroyed()) {
        win = new BrowserWindow({
          ...position,
          width: size,
          height: size,
          transparent: true,
          frame: false,
          alwaysOnTop: true,
          hasShadow: false,
          skipTaskbar: true,
          resizable: false,
          focusable: false,
          show: false,
          backgroundColor: '#00000000',
          webPreferences: {
            preload: join(__dirname, '../preload/preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        });
        this.windows.set(task.id, win);
        win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        win.setAlwaysOnTop(true, 'floating');
        win.setIgnoreMouseEvents(true, { forward: true });
        const sendViewport = () => {
          if (!win!.isDestroyed())
            win!.webContents.send('bubble:viewport', this.viewport(win!.webContents));
        };
        win.on('move', sendViewport);
        win.on('resize', sendViewport);
        lockNavigation(win);
        const bubble = win;
        win.once('ready-to-show', () => {
          this.ready.add(task.id);
          if (this.visible && !this.closing.has(task.id) && !bubble.isDestroyed())
            bubble.showInactive();
        });
        void loadRenderer(win, task.id).catch(() => {
          this.windows.delete(task.id);
          this.ready.delete(task.id);
          if (!bubble.isDestroyed()) bubble.destroy();
        });
      } else if (!this.dragState.has(win.webContents.id)) {
        const b = win.getBounds();
        if (b.width !== size || b.x !== position.x || b.y !== position.y)
          win.setBounds({ ...position, width: size, height: size }, false);
      }
      if (focus === 'FOCUS') win.hide();
      else if (this.ready.has(task.id) && !this.closing.has(task.id) && !win.isVisible())
        win.showInactive();
    });
  }
  drag(sender: WebContents, phase: string, x: number, y: number) {
    const id = this.taskFor(sender);
    const win = id ? this.windows.get(id) : undefined;
    if (!win || !Number.isFinite(x) || !Number.isFinite(y)) return;
    if (phase === 'start') {
      const [left, top] = win.getPosition();
      this.dragState.set(sender.id, { x, y, left, top });
    }
    if (phase === 'move') {
      const d = this.dragState.get(sender.id);
      if (d) {
        const area = screen.getDisplayNearestPoint({ x: Math.round(x), y: Math.round(y) }).workArea;
        const size = win.getSize()[0],
          margin = size * 0.2;
        win.setPosition(
          Math.round(
            Math.max(
              area.x - margin,
              Math.min(d.left + x - d.x, area.x + area.width - size + margin),
            ),
          ),
          Math.round(
            Math.max(
              area.y - margin,
              Math.min(d.top + y - d.y, area.y + area.height - size + margin),
            ),
          ),
          false,
        );
      }
    }
    if (phase === 'end') {
      this.dragState.delete(sender.id);
      const [left, top] = win.getPosition();
      this.persistPosition(id!, { x: left, y: top });
    }
  }
}
