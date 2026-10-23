export type FocusState = 'NORMAL' | 'FOCUS';
export type Urgency = 1 | 2 | 3 | 4;
export type Group = 'None' | 'School' | 'Work' | 'Life';
export type TaskInput = { title: string; url?: string; urgency: Urgency; group?: Group };
export type Task = TaskInput & {
  id: string;
  completed: boolean;
  createdAt?: number;
  completedAt?: number;
  position?: { x: number; y: number };
  snoozedUntil?: number;
};
export type BrowserContext = {
  type: 'CONTEXT_CHANGED';
  browser: 'chrome';
  isFocused: boolean;
  url: string | null;
};
export type Snapshot = {
  tasks: Task[];
  focus: FocusState;
  connected: boolean;
  error: string | null;
  matchedTask: string | null;
};
export type TaskAction = 'complete' | 'restore' | 'delete' | 'snooze';
export type DesktopApi = {
  snapshot(): Promise<Snapshot>;
  subscribe(callback: (snapshot: Snapshot) => void): () => void;
  create(input: TaskInput): Promise<void>;
  update(id: string, input: TaskInput): Promise<void>;
  act(id: string, action: TaskAction): Promise<void>;
  open(id: string): Promise<void>;
  edit(id: string): Promise<void>;
  onEdit(callback: (id: string) => void): () => void;
  pairing(): Promise<{ token: string; port: number }>;
  hide(): void;
  resize(height: number): void;
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
