import type { Task, BubbleLabel } from './types.ts';
import type { Rect } from './layoutEngine.ts';

const overlap = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(Math.max(lo, hi), n));
export function layoutBubbleLabels(
  tasks: readonly Task[],
  area: Rect,
  obstacles: readonly Rect[],
  previous: ReadonlyMap<string, BubbleLabel> = new Map(),
) {
  const labels = new Map<string, BubbleLabel>();
  const occupied: Rect[] = [];
  const ordered = [...tasks].sort(
    (a, b) =>
      Number(b.urgency === 1) - Number(a.urgency === 1) ||
      (a.rank || 0) - (b.rank || 0) ||
      a.id.localeCompare(b.id),
  );
  for (const task of ordered) {
    const size = task.size || 118,
      r = size * 0.305;
    const cx = (task.position?.x || 0) + size / 2,
      cy = (task.position?.y || 0) + size / 2;
    const old = previous.get(task.id);
    let best: { label: BubbleLabel; box: Rect; cost: number } | undefined;
    for (const compact of [false, true]) {
      const fontSize = compact
        ? Math.min(16, Math.max(10, size * 0.052))
        : Math.max(10, Math.min(24, size * 0.052));
      const width = Math.min(compact ? 220 : 300, Math.max(48, size * 0.42), area.width - 24);
      const lines = Math.min(
        compact ? 2 : 3,
        Math.max(
          1,
          Math.ceil(task.title.length / Math.max(1, Math.floor(width / (fontSize * 0.72)))),
        ),
      );
      const height = Math.ceil(
        lines * fontSize * 1.25 + (compact ? 4 : task.urgency > 1 ? 42 : 22),
      );
      const extent = Math.max(0, r * 0.68 - Math.min(Math.hypot(width, height) / 2, r * 0.4));
      const candidates = [...(old ? [{ x: old.x, y: old.y }] : []), { x: cx, y: cy }];
      for (const fraction of [0.3, 0.65, 1])
        for (let i = 0; i < 24; i++) {
          const angle = (i * Math.PI) / 12;
          candidates.push({
            x: cx + Math.cos(angle) * extent * fraction,
            y: cy + Math.sin(angle) * extent * fraction,
          });
        }
      for (const point of candidates) {
        const x = clamp(point.x, area.x + width / 2 + 10, area.x + area.width - width / 2 - 10);
        const y = clamp(point.y, area.y + height / 2 + 10, area.y + area.height - height / 2 - 10);
        const box = {
          x: x - width / 2 - 10,
          y: y - height / 2 - 10,
          width: width + 20,
          height: height + 20,
        };
        const collisions =
          occupied.reduce((sum, b) => sum + overlap(box, b), 0) +
          obstacles.reduce((sum, b) => sum + overlap(box, b), 0);
        const distance = Math.hypot(x - cx, y - cy);
        const movement = old ? Math.hypot(x - old.x, y - old.y) : 0;
        const outside = Math.max(0, distance - extent);
        const cost =
          collisions * 1000 + outside * 40 + movement * 3 + distance + (compact ? 100 : 0);
        if (!best || cost < best.cost)
          best = { label: { x, y, width, height, fontSize, compact }, box, cost };
      }
      if (best && best.cost < 100) break;
    }
    if (best) {
      labels.set(task.id, best.label);
      occupied.push(best.box);
    }
  }
  return labels;
}
