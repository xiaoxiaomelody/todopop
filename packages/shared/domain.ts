import { designerInk, slotColor, vividColor } from './designerColor.ts';
import { validateTaskInput } from './validation.ts';
import type {
  AppState,
  Task,
  TaskInput,
  TaskAction,
  Settings,
  PauseChoice,
  GroupChange,
  ColorSource,
  HistoryEvent,
} from './types.ts';
export const SIDES = ['any', 'left', 'top', 'bottom', 'right'] as const;
export const PALETTE = ['#c8b1ff', '#ffb3ce', '#ffc17e', '#d2d57a', '#76e2c8', '#6ed4f2'];
export function initialState(): AppState {
  return {
    schemaVersion: 2,
    tasks: [],
    history: [],
    groups: [
      { id: 'School', name: 'School', color: { kind: 'palette', slot: 4 }, side: 'any' },
      { id: 'Work', name: 'Work', color: { kind: 'palette', slot: 5 }, side: 'any' },
      { id: 'Life', name: 'Life', color: { kind: 'palette', slot: 2 }, side: 'any' },
    ],
    settings: { tint: '#1a419e', pauseUntil: null, pauseIndefinite: false, layoutSide: 'any' },
  };
}
export function isPaused(settings: Settings, now: number) {
  return settings.pauseIndefinite || Boolean(settings.pauseUntil && settings.pauseUntil > now);
}
function finite(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : fallback;
}
export function hydrate(value: unknown, now = Date.now()): AppState {
  const base = initialState();
  const raw: Partial<AppState> = (
    Array.isArray(value) ? { tasks: value } : value
  ) as Partial<AppState>;
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.tasks) || raw.tasks.length > 5000)
    throw new Error('Invalid task data');
  if ('schemaVersion' in raw && raw.schemaVersion !== 2)
    throw new Error('Unsupported data version; upgrade TODOPOP to read it.');
  if (Array.isArray(raw.groups)) {
    const ids = new Set<string>();
    base.groups = raw.groups.map((g) => {
      validateGroup(g);
      if (!g.id || !g.name || !g.color || !SIDES.includes(g.side) || ids.has(g.id))
        throw new Error('Invalid groups');
      ids.add(g.id);
      if (g.positionLocked !== undefined && typeof g.positionLocked !== 'boolean')
        throw new Error('Invalid group placement');
      return { ...g, color: { ...g.color } };
    });
  }
  const ids = new Set<string>();
  base.tasks = raw.tasks.map((t, index) => {
    if (
      !t ||
      typeof t.id !== 'string' ||
      !t.id ||
      ids.has(t.id) ||
      typeof t.completed !== 'boolean'
    )
      throw new Error('Invalid task');
    ids.add(t.id);
    const input = validateTaskInput(t);
    const groupId = input.groupId ?? (input.group && input.group !== 'None' ? input.group : null);
    return {
      ...input,
      groupId: base.groups.some((g) => g.id === groupId) ? groupId : null,
      id: t.id,
      completed: t.completed,
      createdAt: finite(t.createdAt, now),
      completedAt: t.completedAt === undefined ? undefined : finite(t.completedAt),
      deletedAt: t.deletedAt === undefined ? undefined : finite(t.deletedAt),
      growthMs: finite(t.growthMs),
      focusMs: finite(t.focusMs),
      rank: finite(t.rank, index),
      sourceTaskId: typeof t.sourceTaskId === 'string' ? t.sourceTaskId : undefined,
      position:
        t.position && Number.isFinite(t.position.x) && Number.isFinite(t.position.y)
          ? { x: t.position.x, y: t.position.y }
          : undefined,
    };
  });
  if (raw.settings) base.settings = applySettings(base.settings, raw.settings);
  if (Array.isArray(raw.history)) {
    const eventIds = new Set<string>();
    base.history = raw.history.map((e) => {
      if (
        !e ||
        typeof e.id !== 'string' ||
        eventIds.has(e.id) ||
        typeof e.taskId !== 'string' ||
        !['completed', 'deleted', 'focus'].includes(e.kind) ||
        typeof e.title !== 'string' ||
        ![1, 2, 3, 4].includes(e.urgency) ||
        !Number.isFinite(e.at)
      )
        throw new Error('Invalid history');
      eventIds.add(e.id);
      return { ...e, durationMs: e.durationMs === undefined ? undefined : finite(e.durationMs) };
    });
  } else {
    // Legacy completed tasks become real historical records once during migration.
    base.history = base.tasks
      .filter((t) => t.completed)
      .map((t) => ({
        id: `legacy-${t.id}`,
        taskId: t.id,
        kind: 'completed',
        at: t.completedAt || t.createdAt || now,
        title: t.title,
        urgency: t.urgency,
        groupId: t.groupId,
        durationMs: t.focusMs || 0,
      }));
  }
  return base;
}
export function applySettings(settings: Settings, input: Partial<Settings>): Settings {
  if (!input || typeof input !== 'object') throw new Error('Invalid settings');
  const next = { ...settings };
  if (input.tint !== undefined) {
    if (!/^#[a-fA-F0-9]{6}$/.test(input.tint)) throw new Error('Choose a six-digit color');
    next.tint = input.tint.toLowerCase();
    next.tintWheel = undefined;
  }
  if (input.layoutSide !== undefined) {
    if (!SIDES.includes(input.layoutSide)) throw new Error('Invalid side');
    next.layoutSide = input.layoutSide;
  }
  if (input.pauseUntil !== undefined) {
    if (input.pauseUntil !== null && (!Number.isFinite(input.pauseUntil) || input.pauseUntil < 0))
      throw new Error('Invalid pause');
    next.pauseUntil = input.pauseUntil;
  }
  if (input.pauseIndefinite !== undefined) {
    if (typeof input.pauseIndefinite !== 'boolean') throw new Error('Invalid pause');
    next.pauseIndefinite = input.pauseIndefinite;
  }
  if (input.tintWheel !== undefined) {
    const { h, s } = input.tintWheel;
    if (!Number.isFinite(h) || !Number.isFinite(s) || h < 0 || h >= 360 || s < 0 || s > 1)
      throw new Error('Invalid tint wheel');
    next.tintWheel = { h, s };
    next.tint = designerInk(h, s);
  }
  if (input.tutorialDone !== undefined) {
    if (typeof input.tutorialDone !== 'boolean') throw new Error('Invalid tutorial state');
    next.tutorialDone = input.tutorialDone;
  }
  if (input.interactionVersion !== undefined) {
    if (![1, 2].includes(input.interactionVersion)) throw new Error('Invalid interaction version');
    next.interactionVersion = input.interactionVersion;
  }
  for (const key of ['panelPosition', 'launcherPosition'] as const)
    if (input[key] !== undefined) {
      const p = input[key]!;
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) throw new Error('Invalid position');
      next[key] = { x: p.x, y: p.y };
    }
  return next;
}
export function pauseSettings(settings: Settings, choice: PauseChoice, now: number): Settings {
  if (!['30m', '1h', 'tomorrow', 'manual', 'resume'].includes(choice))
    throw new Error('Invalid pause choice');
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return {
    ...settings,
    pauseIndefinite: choice === 'manual',
    pauseUntil:
      choice === '30m'
        ? now + 1800000
        : choice === '1h'
          ? now + 3600000
          : choice === 'tomorrow'
            ? midnight.getTime()
            : null,
  };
}
function inputFor(state: AppState, input: TaskInput) {
  const clean = validateTaskInput(input);
  const groupId = clean.groupId ?? (clean.group && clean.group !== 'None' ? clean.group : null);
  if (groupId && !state.groups.some((g) => g.id === groupId))
    throw new Error('Choose an existing group');
  return { ...clean, groupId };
}
function capacity(state: AppState) {
  if (state.tasks.filter((t) => !t.completed && !t.deletedAt).length >= 40)
    throw new Error('Keep at most 40 floating tasks');
}
export function addTask(state: AppState, input: TaskInput, id: string, now: number): AppState {
  capacity(state);
  const clean = inputFor(state, input);
  return {
    ...state,
    tasks: [
      ...state.tasks,
      {
        ...clean,
        id,
        createdAt: now,
        completed: false,
        growthMs: 0,
        focusMs: 0,
        rank: Math.max(-1, ...state.tasks.map((t) => t.rank || 0)) + 1,
      },
    ],
  };
}
export function editTask(state: AppState, id: string, input: TaskInput): AppState {
  const clean = inputFor(state, input);
  return {
    ...state,
    tasks: state.tasks.map((t) => (t.id === id && !t.deletedAt ? { ...t, ...clean } : t)),
  };
}
export function taskAction(
  state: AppState,
  id: string,
  action: TaskAction,
  now: number,
  eventId: string,
): AppState {
  const task = state.tasks.find((t) => t.id === id);
  if (!task || task.deletedAt) throw new Error('Task no longer exists');
  if (action === 'restore') return rebubble(state, id, eventId, now);
  if (!['complete', 'delete'].includes(action)) throw new Error('Invalid action');
  if (action === 'complete' && task.completed) return state;
  const event: HistoryEvent = {
    id: eventId,
    taskId: id,
    kind: action === 'complete' ? 'completed' : 'deleted',
    at: now,
    title: task.title,
    urgency: task.urgency,
    groupId: task.groupId,
    durationMs: task.focusMs || 0,
  };
  return {
    ...state,
    tasks: state.tasks.map((t) =>
      t.id !== id
        ? t
        : action === 'delete'
          ? { ...t, deletedAt: now }
          : { ...t, completed: true, completedAt: now },
    ),
    history: [...state.history, event],
  };
}
export function rebubble(state: AppState, id: string, newId: string, now: number): AppState {
  const source = state.tasks.find((t) => t.id === id);
  if (!source) throw new Error('Task not found');
  const next = addTask(
    state,
    {
      title: source.title,
      url: source.url,
      urgency: source.urgency,
      groupId: state.groups.some((g) => g.id === source.groupId) ? source.groupId : null,
    },
    newId,
    now,
  );
  return {
    ...next,
    tasks: next.tasks.map((t) => (t.id === newId ? { ...t, sourceTaskId: id } : t)),
  };
}
export function undoDelete(state: AppState, id: string): AppState {
  const task = state.tasks.find((t) => t.id === id && t.deletedAt);
  if (!task) throw new Error('Nothing to undo');
  if (!task.completed) capacity(state);
  return {
    ...state,
    tasks: state.tasks.map((t) => (t.id === id ? { ...t, deletedAt: undefined } : t)),
    history: state.history.filter(
      (e) => !(e.taskId === id && e.kind === 'deleted' && e.at === task.deletedAt),
    ),
  };
}
function validateGroup(input: GroupChange) {
  if (!input || typeof input !== 'object') throw new Error('Invalid group');
  if (
    input.name !== undefined &&
    (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 24)
  )
    throw new Error('Use a group name between 1 and 24 characters');
  if (input.side !== undefined && !SIDES.includes(input.side)) throw new Error('Invalid side');
  if (input.color) {
    const c = input.color;
    if (c.kind === 'palette') {
      if (!Number.isInteger(c.slot) || c.slot < 0 || c.slot > 5)
        throw new Error('Invalid color slot');
    } else if (c.kind === 'wheel') {
      if (
        !Number.isFinite(c.h) ||
        c.h < 0 ||
        c.h >= 360 ||
        !Number.isFinite(c.saturation) ||
        c.saturation < 0 ||
        c.saturation > 1
      )
        throw new Error('Invalid wheel color');
    } else if (c.kind !== 'custom' || !/^#[a-fA-F0-9]{6}$/.test(c.hex))
      throw new Error('Invalid custom color');
  }
}
export function changeGroup(
  state: AppState,
  action: 'create' | 'update' | 'delete',
  input: GroupChange,
  newId: string,
): AppState {
  validateGroup(input);
  if (action === 'create') {
    if (state.groups.length >= 12) throw new Error('Keep at most 12 groups');
    if (!input.name) throw new Error('Enter a group name');
    return {
      ...state,
      groups: [
        ...state.groups,
        {
          id: newId,
          name: input.name.trim(),
          color: input.color || {
            kind: 'palette',
            slot:
              [0, 1, 2, 3, 4, 5].find(
                (i) => !state.groups.some((g) => g.color.kind === 'palette' && g.color.slot === i),
              ) ?? 0,
          },
          side: input.side || 'any',
        },
      ],
    };
  }
  const group = state.groups.find((g) => g.id === input.id);
  if (!group) throw new Error('Group not found');
  if (action === 'delete')
    return {
      ...state,
      groups: state.groups.filter((g) => g.id !== input.id),
      tasks: state.tasks.map((t) =>
        t.groupId === input.id ? { ...t, groupId: null, group: 'None' } : t,
      ),
    };
  if (action !== 'update') throw new Error('Invalid group action');
  const occupied =
    input.color?.kind === 'palette'
      ? state.groups.find(
          (g) =>
            g.id !== group.id &&
            g.color.kind === 'palette' &&
            g.color.slot === (input.color as { slot: number }).slot,
        )
      : undefined;
  return {
    ...state,
    groups: state.groups.map((g) =>
      g.id === group.id
        ? { ...g, ...input, name: input.name?.trim() || g.name, id: group.id }
        : g.id === occupied?.id
          ? { ...g, color: group.color }
          : g,
    ),
  };
}
export function reorder(state: AppState, ids: string[]): AppState {
  const active = state.tasks.filter((t) => !t.completed && !t.deletedAt);
  if (
    !Array.isArray(ids) ||
    ids.length !== active.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !active.some((t) => t.id === id))
  )
    throw new Error('Invalid task order');
  return {
    ...state,
    tasks: state.tasks.map((t) => (ids.includes(t.id) ? { ...t, rank: ids.indexOf(t.id) } : t)),
  };
}
export function groupColor(color: ColorSource, tint = '#1a419e'): string {
  if (color.kind === 'custom') return color.hex;
  if (color.kind === 'wheel') return vividColor(color.h, color.saturation);
  return slotColor(color.slot, tint);
}
export function hexHue(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255,
    g = parseInt(hex.slice(3, 5), 16) / 255,
    b = parseInt(hex.slice(5, 7), 16) / 255,
    max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  if (!d) return 0;
  return (
    ((max === r ? (g - b) / d : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + 360) % 360
  );
}

export function undoCompletion(state: AppState, id: string): AppState {
  const task = state.tasks.find((t) => t.id === id && t.completed && !t.deletedAt);
  if (!task) throw new Error('Nothing to undo');
  capacity(state);
  return {
    ...state,
    tasks: state.tasks.map((t) =>
      t.id === id ? { ...t, completed: false, completedAt: undefined } : t,
    ),
    history: state.history.filter(
      (e) => !(e.taskId === id && e.kind === 'completed' && e.at === task.completedAt),
    ),
  };
}
