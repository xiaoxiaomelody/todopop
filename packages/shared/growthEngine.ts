import { BUBBLE_SIZE, type Task } from './types.ts';
export const PX_PER_LOGICAL_CM = 37.8;
export const GROWTH_RATE = { 1: 0, 2: 0.25, 3: 0.5, 4: 1 } as const;
export const DEMO_SPEED = 60;
export function bubbleSize(task: Task, elapsed = task.growthMs || 0): number {
  const visibleIncrease =
    ((Math.max(0, elapsed) * PX_PER_LOGICAL_CM) / 120000) * GROWTH_RATE[task.urgency];
  return Math.round(BUBBLE_SIZE[task.urgency] + visibleIncrease / 0.61);
}
export function grow(
  tasks: readonly Task[],
  elapsed: number,
  now: number,
  stopped: boolean,
): Task[] {
  const dt = Math.max(0, Math.min(5000, elapsed));
  return tasks.map((t) =>
    stopped || t.completed || t.deletedAt || (t.snoozedUntil && t.snoozedUntil > now)
      ? t
      : { ...t, growthMs: (t.growthMs || 0) + dt },
  );
}
