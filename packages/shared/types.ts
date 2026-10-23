export type FocusState = 'NORMAL' | 'FOCUS';
export type Urgency = 1 | 2 | 3 | 4;
export type Group = 'None' | 'School' | 'Work' | 'Life';
export type Side = 'any' | 'left' | 'top' | 'bottom' | 'right';
export type PauseChoice = '30m' | '1h' | 'tomorrow' | 'manual' | 'resume';
export type ColorSource = { kind: 'palette'; slot: number } | { kind: 'custom'; hex: string };
export type TaskGroup = {
  id: string;
  name: string;
  color: ColorSource;
  side: Side;
  positionLocked?: boolean;
};
export type TaskInput = {
  title: string;
  url?: string;
  urgency: Urgency;
  group?: Group;
  groupId?: string | null;
};
export type Task = TaskInput & {
  id: string;
  completed: boolean;
  createdAt?: number;
  completedAt?: number;
  position?: { x: number; y: number };
  snoozedUntil?: number;
  deletedAt?: number;
  growthMs?: number;
  focusMs?: number;
  rank?: number;
  sourceTaskId?: string;
  size?: number;
  renderOffset?: { x: number; y: number };
};
export type HistoryEvent = {
  id: string;
  taskId: string;
  kind: 'completed' | 'deleted' | 'focus';
  at: number;
  title: string;
  urgency: Urgency;
  groupId?: string | null;
  durationMs?: number;
};
export type Settings = {
  tint: string;
  interactionVersion?: number;
  tutorialDone?: boolean;
  pauseUntil: number | null;
  pauseIndefinite: boolean;
  layoutSide: Side;
  panelPosition?: { x: number; y: number };
  launcherPosition?: { x: number; y: number };
};
export type AppState = {
  schemaVersion: 2;
  tasks: Task[];
  groups: TaskGroup[];
  history: HistoryEvent[];
  settings: Settings;
};
export type BrowserContext = {
  type: 'CONTEXT_CHANGED';
  browser: 'chrome';
  isFocused: boolean;
  url: string | null;
};
export type Snapshot = {
  tasks: Task[];
  groups: TaskGroup[];
  history: HistoryEvent[];
  settings: Settings;
  focus: FocusState;
  connected: boolean;
  error: string | null;
  matchedTask: string | null;
  billboardId: string | null;
  selectedGroupId: string | null;
  coverage: number;
  paused: boolean;
  full: boolean;
  growthMode: 'real' | 'demo';
  toast: { message: string; undoId?: string } | null;
};
export type TaskAction = 'complete' | 'restore' | 'delete' | 'snooze' | 'wake';
export type GroupChange = { id?: string; name?: string; side?: Side; color?: ColorSource };
export type DesktopApi = {
  snapshot(): Promise<Snapshot>;
  subscribe(callback: (snapshot: Snapshot) => void): () => void;
  create(input: TaskInput): Promise<void>;
  update(id: string, input: TaskInput): Promise<void>;
  act(id: string, action: TaskAction): Promise<void>;
  open(id: string): Promise<void>;
  edit(id: string): Promise<void>;
  onEdit(callback: (id: string) => void): () => void;
  exitFocus(): Promise<void>;
  selectGroup(id: string | null): Promise<void>;
  dragGroup(phase: 'start' | 'move' | 'end', x: number, y: number, groupId?: string): void;
  pairing(): Promise<{ token: string; port: number }>;
  setSettings(input: Partial<Settings>): Promise<void>;
  growthMode(mode: 'real' | 'demo'): Promise<void>;
  groups(action: 'create' | 'update' | 'delete', input: GroupChange): Promise<void>;
  arrange(side: Side | 'shuffle'): Promise<void>;
  reorder(ids: string[]): Promise<void>;
  undo(id: string): Promise<void>;
  hide(): void;
  resize(height: number, width?: number): void;
  dragPanel(phase: 'start' | 'move' | 'end', x: number, y: number): void;
  drag(phase: 'start' | 'move' | 'end', x: number, y: number): void;
};
export const BUBBLE_SIZE: Record<Urgency, number> = { 1: 118, 2: 192, 3: 298, 4: 446 };
export const URGENCY_LABEL: Record<Urgency, string> = {
  1: 'REMIND',
  2: 'SOON',
  3: 'TODAY',
  4: 'NOW!',
};
export const GROUP_COLOR: Record<Group, string> = {
  None: 'transparent',
  School: '#19c6a1',
  Work: '#00b8e7',
  Life: '#f99443',
};
