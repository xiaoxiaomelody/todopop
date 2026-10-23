import type { Side, Task } from './types.ts';
export type Rect = { x: number; y: number; width: number; height: number };
export type LayoutItem = { id: string; x: number; y: number; size: number; side: Side };
export function layoutBubbles(
  tasks: readonly Task[],
  area: Rect,
  obstacles: readonly Rect[],
  previous: Map<string, LayoutItem>,
  sideFor: (task: Task) => Side,
): { items: LayoutItem[]; full: boolean; coverage: number } {
  const circles = tasks.map((t, i) => {
    const size = Math.min(t.size || 118, Math.max(area.width, area.height) * 1.6),
      r = size * 0.305;
    const p = previous.get(t.id);
    return {
      id: t.id,
      size,
      r,
      side: sideFor(t),
      cx:
        t.position && !p
          ? t.position.x + size / 2
          : p
            ? p.x + p.size / 2
            : area.x + 70 + ((i * 211) % Math.max(100, area.width - 140)),
      cy:
        t.position && !p
          ? t.position.y + size / 2
          : p
            ? p.y + p.size / 2
            : area.y + 80 + ((i * 149) % Math.max(100, area.height - 160)),
    };
  });
  for (let pass = 0; pass < 24; pass++)
    for (let i = 0; i < circles.length; i++) {
      const c = circles[i];
      for (let j = i + 1; j < circles.length; j++) {
        const d = circles[j];
        let dx = d.cx - c.cx,
          dy = d.cy - c.cy;
        let dist = Math.hypot(dx, dy);
        const overlap = c.r + d.r + 8 - dist;
        if (overlap > 0) {
          if (dist < 0.01) {
            dx = 1;
            dy = 0.3;
            dist = Math.hypot(dx, dy);
          }
          const move = overlap * 0.51;
          c.cx -= (dx / dist) * move;
          c.cy -= (dy / dist) * move;
          d.cx += (dx / dist) * move;
          d.cy += (dy / dist) * move;
        }
      }
      for (const rect of obstacles) {
        const x = Math.max(rect.x - 10, Math.min(c.cx, rect.x + rect.width + 10)),
          y = Math.max(rect.y - 10, Math.min(c.cy, rect.y + rect.height + 10));
        let dx = c.cx - x,
          dy = c.cy - y,
          dist = Math.hypot(dx, dy);
        if (dist < c.r) {
          if (dist < 0.1) {
            const options = [
              { d: Math.abs(c.cx - (rect.x - c.r - 12)), x: rect.x - c.r - 12, y: c.cy },
              {
                d: Math.abs(c.cx - (rect.x + rect.width + c.r + 12)),
                x: rect.x + rect.width + c.r + 12,
                y: c.cy,
              },
              { d: Math.abs(c.cy - (rect.y - c.r - 12)), x: c.cx, y: rect.y - c.r - 12 },
              {
                d: Math.abs(c.cy - (rect.y + rect.height + c.r + 12)),
                x: c.cx,
                y: rect.y + rect.height + c.r + 12,
              },
            ];
            const best = options.sort((a, b) => a.d - b.d)[0];
            c.cx = best.x;
            c.cy = best.y;
          } else {
            c.cx += (dx / dist) * (c.r - dist);
            c.cy += (dy / dist) * (c.r - dist);
          }
        }
      }
      const inset = 12,
        rx = Math.min(c.r, area.width / 2 - inset),
        ry = Math.min(c.r, area.height / 2 - inset);
      c.cx = Math.max(area.x + rx + inset, Math.min(c.cx, area.x + area.width - rx - inset));
      c.cy = Math.max(area.y + ry + inset, Math.min(c.cy, area.y + area.height - ry - inset));
      if (c.side === 'left') c.cx = area.x + rx + inset;
      if (c.side === 'right') c.cx = area.x + area.width - rx - inset;
      if (c.side === 'top') c.cy = area.y + ry + inset;
      if (c.side === 'bottom') c.cy = area.y + area.height - ry - inset;
    }
  const available = Math.max(
    1,
    area.width * area.height - obstacles.reduce((sum, o) => sum + o.width * o.height, 0),
  );
  const coverage = circles.reduce((sum, c) => sum + Math.PI * c.r * c.r, 0) / available;
  return {
    items: circles.map((c) => ({
      id: c.id,
      x: Math.round(c.cx - c.size / 2),
      y: Math.round(c.cy - c.size / 2),
      size: c.size,
      side: c.side,
    })),
    full: coverage >= 0.76,
    coverage,
  };
}

// Keep controls readable and reachable even when the growing body is larger than a display.
export function bubbleToolbarPosition(body: Rect, viewport: Rect) {
  const width = 112,
    height = 32,
    inset = 8;
  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(value, Math.max(min, max)));
  return {
    x: clamp(
      body.x + body.width / 2,
      viewport.x + width / 2 + inset,
      viewport.x + viewport.width - width / 2 - inset,
    ),
    y: clamp(
      body.y + body.height - height - inset,
      viewport.y + inset,
      viewport.y + viewport.height - height - inset,
    ),
  };
}
