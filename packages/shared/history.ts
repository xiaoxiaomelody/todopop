import type { HistoryEvent } from './types.ts';
export function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function historySummary(events: readonly HistoryEvent[], start: number, end: number) {
  const counts: Record<string, number> = {};
  let completed = 0,
    focusMs = 0;
  for (const event of events) {
    if (event.kind === 'completed' && event.at >= start && event.at < end) {
      completed++;
      const day = dayKey(new Date(event.at));
      counts[day] = (counts[day] || 0) + 1;
    }
    if (event.kind === 'focus' && event.durationMs)
      focusMs += Math.max(
        0,
        Math.min(end, event.at) - Math.max(start, event.at - event.durationMs),
      );
  }
  return { completed, focusMs, counts };
}
