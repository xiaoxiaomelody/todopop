import { BrowserWindow, screen, type WebContents } from 'electron';
import { join } from 'node:path';
import { BUBBLE_SIZE, type Task, type FocusState } from '@todopop/shared';
export function lockNavigation(win: BrowserWindow) {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
}
export async function loadRenderer(win: BrowserWindow, taskId?: string) {
  const hash = taskId ? `bubble=${encodeURIComponent(taskId)}` : '';
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
  sync(tasks: Task[], focus: FocusState) {
    this.visible = focus === 'NORMAL';
    const wanted = tasks.filter(
      (t) => !t.completed && !(t.snoozedUntil && t.snoozedUntil > Date.now()),
    );
    for (const [id, win] of this.windows)
      if (!wanted.some((t) => t.id === id) && !this.closing.has(id)) {
        this.closing.add(id);
        win.webContents.send('bubble:pop');
        setTimeout(() => {
          if (!win.isDestroyed()) win.destroy();
          this.windows.delete(id);
          this.ready.delete(id);
          this.closing.delete(id);
        }, 360);
      }
    wanted.forEach((task, index) => {
      let win = this.windows.get(task.id);
      const size = BUBBLE_SIZE[task.urgency];
      if (!win) {
        const area = screen.getPrimaryDisplay().workArea;
        const position = this.clamp(
          task.position?.x ?? area.x + 20 + ((index * 213) % Math.max(220, area.width - size)),
          task.position?.y ?? area.y + 40 + ((index * 137) % Math.max(180, area.height - size)),
          size,
          size,
        );
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
        lockNavigation(win);
        const bubble = win;
        win.once('ready-to-show', () => {
          this.ready.add(task.id);
          if (this.visible && !this.closing.has(task.id)) bubble.showInactive();
        });
        void loadRenderer(win, task.id);
      } else if (win.getSize()[0] !== size) {
        const [x, y] = win.getPosition();
        win.setBounds({ ...this.clamp(x, y, size, size), width: size, height: size });
      }
      if (focus === 'FOCUS') win.hide();
      else if (this.ready.has(task.id) && !this.closing.has(task.id) && !win.isVisible())
        win.showInactive();
    });
  }
  private clamp(x: number, y: number, width: number, height: number) {
    const area = screen.getDisplayNearestPoint({ x: Math.round(x), y: Math.round(y) }).workArea;
    return {
      x: Math.round(Math.max(area.x, Math.min(x, area.x + area.width - width))),
      y: Math.round(Math.max(area.y, Math.min(y, area.y + area.height - height))),
    };
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
        const [w, h] = win.getSize();
        const p = this.clamp(d.left + x - d.x, d.top + y - d.y, w, h);
        win.setPosition(p.x, p.y, false);
      }
    }
    if (phase === 'end') {
      this.dragState.delete(sender.id);
      const [left, top] = win.getPosition();
      this.persistPosition(id!, { x: left, y: top });
    }
  }
}
