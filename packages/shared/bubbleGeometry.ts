import type { Task } from './types.ts';
import type { Rect } from './layoutEngine.ts';
export type Point = { x: number; y: number };
export const COVERAGE_LIMIT = 0.95;
// The same polygon drives the visible SVG, hit testing and coverage measurement.
export function bubbleOutline(task: Task, neighbors: readonly Task[], samples = 64): Point[] {
  const size = task.size || 118,
    r = size * 0.305;
  const cx = (task.position?.x || 0) + size / 2,
    cy = (task.position?.y || 0) + size / 2;
  const contacts = neighbors
    .filter((t) => t.id !== task.id)
    .map((t) => {
      const s = t.size || 118,
        dx = (t.position?.x || 0) + s / 2 - cx,
        dy = (t.position?.y || 0) + s / 2 - cy;
      return {
        angle: Math.atan2(dy, dx),
        depth: Math.max(0, Math.min(r * 0.23, (r + s * 0.305 + 10 - Math.hypot(dx, dy)) * 0.65)),
      };
    })
    .filter((c) => c.depth > 0);
  return Array.from({ length: samples }, (_, i) => {
    const a = (i / samples) * Math.PI * 2;
    let radius = r * (1 + 0.012 * Math.sin(a * 3 + task.urgency));
    for (const c of contacts) {
      const delta = Math.atan2(Math.sin(a - c.angle), Math.cos(a - c.angle));
      radius -= c.depth * Math.exp((-delta * delta) / 0.14);
      radius += c.depth * 0.13 * Math.pow(Math.sin(delta), 2);
    }
    radius = Math.max(r * 0.6, radius);
    return { x: size / 2 + Math.cos(a) * radius, y: size / 2 + Math.sin(a) * radius };
  });
}
export function polygonPath(points: readonly Point[]) {
  return (
    points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ') + 'Z'
  );
}
// Scanline integration of the clipped polygon union, not a sum of overlapping circles.
// A <= 1px vertical step bounds error around the threshold; horizontal intervals are exact.
export function unionCoverage(
  polygons: readonly (readonly Point[])[],
  area: Rect,
  step = 1,
  exclusions: readonly Rect[] = [],
): number {
  if (area.width <= 0 || area.height <= 0) return 0;
  let covered = 0;
  for (let row = area.y; row < area.y + area.height; row += step) {
    const h = Math.min(step, area.y + area.height - row),
      y = row + h / 2;
    const spans: [number, number][] = [];
    for (const poly of polygons) {
      const hits: number[] = [];
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[j],
          b = poly[i];
        if (a.y > y !== b.y > y) hits.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
      }
      hits.sort((a, b) => a - b);
      for (let i = 0; i + 1 < hits.length; i += 2) {
        const left = Math.max(area.x, hits[i]),
          right = Math.min(area.x + area.width, hits[i + 1]);
        if (right > left) spans.push([left, right]);
      }
    }
    spans.sort((a, b) => a[0] - b[0]);
    let left = spans[0]?.[0] || 0,
      right = left,
      width = 0;
    for (const s of spans) {
      if (s[0] > right) {
        width += right - left;
        [left, right] = s;
      } else right = Math.max(right, s[1]);
    }
    const totalWidth = width + right - left;
    const blockers = exclusions
      .filter((r) => y >= r.y && y < r.y + r.height)
      .map(
        (r) =>
          [Math.max(r.x, area.x), Math.min(r.x + r.width, area.x + area.width)] as [number, number],
      )
      .filter(([l, r]) => r > l);
    // Intersect blocker intervals with occupied spans; merge intersections before subtracting.
    const cuts: [number, number][] = [];
    for (const [l, r] of spans)
      for (const [bl, br] of blockers)
        if (Math.min(r, br) > Math.max(l, bl)) cuts.push([Math.max(l, bl), Math.min(r, br)]);
    cuts.sort((a, b) => a[0] - b[0]);
    let cut = 0,
      end = -Infinity;
    for (const [l, r] of cuts) {
      cut += Math.max(0, r - Math.max(l, end));
      end = Math.max(end, r);
    }
    covered += (totalWidth - cut) * h;
  }
  return Math.max(0, Math.min(1, covered / (area.width * area.height)));
}
export function visibleCoverage(
  tasks: readonly Task[],
  area: Rect,
  exclusions: readonly Rect[] = [],
) {
  return unionCoverage(
    tasks.map((t) =>
      (t.contour || bubbleOutline(t, tasks)).map((p) => ({
        x: p.x + (t.position?.x || 0),
        y: p.y + (t.position?.y || 0),
      })),
    ),
    area,
    1,
    exclusions,
  );
}

export function clippedBubbleFrame(size: number, position: Point, area: Rect): Rect {
  const x = Math.min(area.x + area.width - 1, Math.max(area.x, position.x));
  const y = Math.min(area.y + area.height - 1, Math.max(area.y, position.y));
  return {
    x,
    y,
    width: Math.max(1, Math.min(position.x + size, area.x + area.width) - x),
    height: Math.max(1, Math.min(position.y + size, area.y + area.height) - y),
  };
}
