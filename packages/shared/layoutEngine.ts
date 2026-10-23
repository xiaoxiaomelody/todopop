import type { Side, Task } from './types.ts';
export type Rect = { x: number; y: number; width: number; height: number };
export type LayoutItem = { id: string; x: number; y: number; size: number; side: Side };
export function layoutBubbles(
  tasks: readonly Task[],
  area: Rect,
  obstacles: readonly Rect[],
  previous: Map<string, LayoutItem>,
  sideFor: (task: Task) => Side,
  pinned: ReadonlySet<string> = new Set(),
): { items: LayoutItem[] } {
  const circles = tasks.map((t, i) => {
    const size = Math.min(t.size || 118, Math.max(area.width, area.height) * 2.2),
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
        const overlap = (c.r + d.r) * 0.92 - dist;
        if (overlap > 0) {
          if (dist < 0.01) {
            dx = 1;
            dy = 0.3;
            dist = Math.hypot(dx, dy);
          }
          const move = overlap * 0.51;
          if (!pinned.has(c.id)) {
            c.cx -= (dx / dist) * move;
            c.cy -= (dy / dist) * move;
          }
          if (!pinned.has(d.id)) {
            d.cx += (dx / dist) * move;
            d.cy += (dy / dist) * move;
          }
        }
      }
      if (pinned.has(c.id)) {
        c.cx = Math.max(area.x + 16, Math.min(c.cx, area.x + area.width - 16));
        c.cy = Math.max(area.y + 16, Math.min(c.cy, area.y + area.height - 16));
        continue;
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
  // Designer's edge queue: retain order along the edge; overflow moves into a second lane.
  for (const side of ['left', 'right', 'top', 'bottom'] as Side[]) {
    const vertical = side === 'left' || side === 'right',
      along = vertical ? area.height : area.width,
      across = vertical ? area.width : area.height,
      m = 16,
      gap = 8;
    const list = circles.filter((c) => c.side === side && !pinned.has(c.id));
    const giants = list.filter((c) => c.r > Math.min(along, across) / 2 - m);
    for (const c of giants) {
      c.cx = area.x + area.width / 2;
      c.cy = area.y + area.height / 2;
    }
    const normal = list
      .filter((c) => !giants.includes(c))
      .sort((a, b) => (vertical ? a.cy - b.cy : a.cx - b.cx));
    const need = normal.reduce((sum, c) => sum + 2 * c.r + gap, -gap);
    if (need > along - 2 * m) {
      let pos = m,
        lane = m,
        laneWidth = 0;
      for (const c of normal) {
        const d = 2 * c.r;
        if (pos + d > along - m && pos > m) {
          lane += laneWidth + gap;
          pos = m;
          laneWidth = 0;
        }
        const cross = Math.min(across - m - c.r, lane + c.r),
          axis = pos + c.r;
        const x = side === 'right' ? across - cross : cross,
          y = side === 'bottom' ? across - cross : cross;
        if (vertical) {
          c.cx = area.x + x;
          c.cy = area.y + axis;
        } else {
          c.cx = area.x + axis;
          c.cy = area.y + y;
        }
        pos += d + gap;
        laneWidth = Math.max(laneWidth, d);
      }
    } else {
      const items = normal.map((c) => ({
        c,
        a: Math.max(m + c.r, Math.min(vertical ? c.cy - area.y : c.cx - area.x, along - m - c.r)),
      }));
      for (let pass = 0; pass < 3; pass++) {
        let end = m;
        for (const it of items) {
          it.a = Math.max(it.a, end + it.c.r);
          end = it.a + it.c.r + gap;
        }
        let limit = along - m;
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          it.a = Math.min(it.a, limit - it.c.r);
          limit = it.a - it.c.r - gap;
        }
      }
      for (const { c, a } of items) {
        if (vertical) {
          c.cx = side === 'left' ? area.x + m + c.r : area.x + area.width - m - c.r;
          c.cy = area.y + a;
        } else {
          c.cx = area.x + a;
          c.cy = side === 'top' ? area.y + m + c.r : area.y + area.height - m - c.r;
        }
      }
    }
  }
  return {
    items: circles.map((c) => ({
      id: c.id,
      x: Math.round(c.cx - c.size / 2),
      y: Math.round(c.cy - c.size / 2),
      size: c.size,
      side: c.side,
    })),
  };
}
