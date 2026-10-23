import { BrowserWindow, screen, type WebContents } from 'electron';
import { join } from 'node:path';
import { BUBBLE_SIZE, clippedBubbleFrame, type Task, type FocusState } from '@todopop/shared';
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
  private logical = new Map<string, { x: number; y: number; size: number }>();
  private ready = new Set<string>();
  private visible = true;
  private closing = new Set<string>();
  private closingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private dragState = new Map<
    number,
    { x: number; y: number; left: number; top: number; moved: boolean }
  >();
  constructor(
    private persistPosition: (id: string, position: { x: number; y: number }) => void,
    private moved?: (id: string, position: { x: number; y: number }) => void,
  ) {}
  draggingIds() {
    return [...this.dragState.keys()]
      .map(
        (id) => [...this.windows].find(([, w]) => !w.isDestroyed() && w.webContents.id === id)?.[0],
      )
      .filter((id): id is string => Boolean(id));
  }
  taskFor(sender: WebContents) {
    if (sender.isDestroyed()) return undefined;
    return [...this.windows].find(
      ([, w]) => !w.isDestroyed() && w.webContents.id === sender.id,
    )?.[0];
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
        const timer = setTimeout(() => {
          this.windows.delete(id);
          this.logical.delete(id);
          this.ready.delete(id);
          this.closing.delete(id);
          if (!win.isDestroyed()) {
            this.dragState.delete(win.webContents.id);
            win.destroy();
          }
          this.closingTimers.delete(id);
        }, 520);
        this.closingTimers.set(id, timer);
      }
    wanted.forEach((task, index) => {
      let win = this.windows.get(task.id);
      if (this.closing.has(task.id)) {
        clearTimeout(this.closingTimers.get(task.id));
        this.closingTimers.delete(task.id);
        this.closing.delete(task.id);
        this.ready.delete(task.id);
        if (win && !win.isDestroyed()) win.destroy();
        this.windows.delete(task.id);
        win = undefined;
      }
      const size = Math.round(task.size || BUBBLE_SIZE[task.urgency]);
      const area = screen.getPrimaryDisplay().workArea;
      const position = task.position || {
        x: area.x + 20 + index * 90,
        y: area.y + 60 + index * 60,
      };
      this.logical.set(task.id, { ...position, size });
      const frame = clippedBubbleFrame(size, position, area);
      if (!win || win.isDestroyed()) {
        win = new BrowserWindow({
          ...frame,
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
          if (this.visible && !this.closing.has(task.id) && !bubble.isDestroyed())
            bubble.showInactive();
        });
        void loadRenderer(win, task.id).catch(() => {
          this.windows.delete(task.id);
          this.ready.delete(task.id);
          if (!bubble.isDestroyed()) bubble.destroy();
        });
      } else {
        const b = win.getBounds();
        if (
          b.width !== frame.width ||
          b.height !== frame.height ||
          b.x !== frame.x ||
          b.y !== frame.y
        )
          win.setBounds(frame, false);
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
      const origin = this.logical.get(id!)!;
      this.dragState.set(sender.id, { x, y, left: origin.x, top: origin.y, moved: false });
    }
    if (phase === 'move') {
      const d = this.dragState.get(sender.id);
      if (d) {
        d.moved = true;
        const area = screen.getDisplayNearestPoint({ x: Math.round(x), y: Math.round(y) }).workArea;
        const size = this.logical.get(id!)!.size,
          margin = size * 0.2;
        const clamp = (v: number, lo: number, hi: number) =>
          Math.max(lo, Math.min(v, Math.max(lo, hi)));
        const position = {
          x: Math.round(
            clamp(d.left + x - d.x, area.x - margin, area.x + area.width - size + margin),
          ),
          y: Math.round(
            clamp(d.top + y - d.y, area.y - margin, area.y + area.height - size + margin),
          ),
        };
        this.logical.set(id!, { ...position, size });
        win.setBounds(clippedBubbleFrame(size, position, area), false);
        this.moved?.(id!, position);
      }
    }
    if (phase === 'end') {
      const moved = this.dragState.get(sender.id)?.moved;
      this.dragState.delete(sender.id);
      const position = this.logical.get(id!)!;
      if (moved) this.persistPosition(id!, { x: position.x, y: position.y });
    }
  }
}
