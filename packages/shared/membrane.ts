// Membrane spring/constraint model adapted from the supplied designer prototype.
import type { Task } from './types.ts';
import type { Rect } from './layoutEngine.ts';
import type { Point } from './bubbleGeometry.ts';
const N = 40,
  TAU = Math.PI * 2,
  OUT = 0.08,
  GAP = 2.5,
  SQUISH = 9;
const cos = Array.from({ length: N }, (_, i) => Math.cos((i / N) * TAU)),
  sin = Array.from({ length: N }, (_, i) => Math.sin((i / N) * TAU));
export type Membrane = {
  d: Float64Array;
  v: Float64Array;
  lastX: number;
  lastY: number;
  time: number;
};
export const createMembrane = (): Membrane => ({
  d: new Float64Array(N),
  v: new Float64Array(N),
  lastX: NaN,
  lastY: NaN,
  time: 0,
});
function boxRay(x: number, y: number, dx: number, dy: number, b: Rect) {
  let lo = -Infinity,
    hi = Infinity;
  for (const [c, d, min, max] of [
    [x, dx, b.x, b.x + b.width],
    [y, dy, b.y, b.y + b.height],
  ]) {
    if (Math.abs(d) < 1e-6) {
      if (c < min || c > max) return Infinity;
      continue;
    }
    let a = (min - c) / d,
      z = (max - c) / d;
    if (a > z) [a, z] = [z, a];
    lo = Math.max(lo, a);
    hi = Math.min(hi, z);
  }
  return hi < 0 || lo > hi ? Infinity : Math.max(0, lo);
}
export function membraneStep(
  m: Membrane,
  task: Task,
  peers: readonly Task[],
  obstacles: readonly Rect[],
  dt: number,
  mouse?: { x: number; y: number; vx: number; vy: number },
  dragging = false,
  reduced = false,
): { points: Point[]; dx: number; dy: number } {
  dt = Math.max(0.001, Math.min(1 / 30, dt));
  m.time += dt;
  const size = task.size || 118,
    r = size * 0.305,
    hx = (task.position?.x || 0) + size / 2,
    hy = (task.position?.y || 0) + size / 2;
  let seed = 0;
  for (const c of task.id) seed = (seed * 31 + c.charCodeAt(0)) % 10000;
  const phase = (seed / 10000) * TAU;
  const drift = dragging ? 0 : reduced ? 1.5 : 7,
    dx = (Math.sin(m.time * 0.23 + phase) + Math.sin(m.time * 0.51 + phase * 2) * 0.4) * drift,
    dy = (Math.cos(m.time * 0.19 + phase) + Math.cos(m.time * 0.43 + phase * 1.7) * 0.4) * drift;
  const cx = hx + dx,
    cy = hy + dy,
    t = new Float64Array(N),
    lim = new Float64Array(N);
  lim.fill(r * OUT);
  const ax = Number.isFinite(m.lastX) ? Math.max(-1800, Math.min(1800, (hx - m.lastX) / dt)) : 0,
    ay = Number.isFinite(m.lastY) ? Math.max(-1800, Math.min(1800, (hy - m.lastY) / dt)) : 0;
  m.lastX = hx;
  m.lastY = hy;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU,
      w = reduced ? 0.004 : 0.016;
    t[i] =
      r *
      (w * Math.sin(2 * a + m.time * 1.1 + phase) +
        w * 0.7 * Math.sin(3 * a - m.time * 0.8 + phase * 1.3) +
        w * 0.4 * Math.sin(5 * a + m.time * 1.7));
    m.v[i] -= (cos[i] * ax + sin[i] * ay) * (reduced ? 0.0004 : 0.0016) * r * dt * 15;
  }
  for (const o of peers) {
    if (o.id === task.id) continue;
    const rb = (o.size || 118) * 0.305,
      ox = (o.position?.x || 0) + (o.size || 118) / 2,
      oy = (o.position?.y || 0) + (o.size || 118) / 2,
      D = Math.hypot(ox - cx, oy - cy),
      eB = rb * (1 + OUT) + GAP;
    if (D > r * (1 + OUT) + eB || D < 0.01) continue;
    const nx = (ox - cx) / D,
      ny = (oy - cy) / D,
      lo = Math.min(r * 0.8, D * 0.5),
      hi = D - Math.min(rb * 0.8, D * 0.5);
    let split = (D * D + r * r - rb * rb) / (2 * D);
    split = lo <= hi ? Math.max(lo, Math.min(hi, split)) : (D * r) / (r + rb);
    const limit = (c: number, s: number) => {
      const un = c * nx + s * ny;
      if (un <= 0.001) return Infinity;
      const proj = D * un,
        p2 = D * D - proj * proj;
      if (p2 >= eB * eB) return Infinity;
      const root = Math.sqrt(eB * eB - p2),
        line = split / un;
      if (line >= proj + root) return Infinity;
      return Math.max(proj - root, line) - GAP + SQUISH - r;
    };
    for (let i = 0; i < N; i++) {
      let l = limit(cos[i], sin[i]);
      for (const off of [-0.5, 0.5]) {
        const a = ((i + off) / N) * TAU,
          half = limit(Math.cos(a), Math.sin(a));
        if (half < Infinity) l = Math.min(l, (half + r) / Math.cos(Math.PI / N) - r);
      }
      lim[i] = Math.min(lim[i], Math.max(-r * 0.94, l));
    }
  }
  for (const b of obstacles)
    for (let i = 0; i < N; i++) {
      const distance = boxRay(cx, cy, cos[i], sin[i], b);
      if (Number.isFinite(distance)) lim[i] = Math.min(lim[i], Math.max(-r * 0.94, distance - r));
    }
  if (mouse && !reduced)
    for (let i = 0; i < N; i++) {
      const px = cx + cos[i] * (r + m.d[i]),
        py = cy + sin[i] * (r + m.d[i]),
        q = (px - mouse.x) ** 2 + (py - mouse.y) ** 2,
        w = Math.exp(-q / (2 * 55 * 55));
      m.v[i] += (cos[i] * mouse.vx + sin[i] * mouse.vy) * w * 0.045;
      if (q < 26 * 26) m.v[i] -= (1 - Math.sqrt(q) / 26) * 40;
    }
  for (let i = 0; i < N; i++) t[i] = Math.min(t[i], lim[i]);
  const h = dt / 3;
  for (let sub = 0; sub < 3; sub++) {
    for (let i = 0; i < N; i++) {
      const a =
        420 * (t[i] - m.d[i]) +
        300 * (m.d[(i + N - 1) % N] + m.d[(i + 1) % N] - 2 * m.d[i]) -
        9 * m.v[i];
      m.v[i] += a * h;
    }
    for (let i = 0; i < N; i++) {
      m.d[i] += m.v[i] * h;
      if (m.d[i] > lim[i]) {
        m.d[i] = lim[i];
        if (m.v[i] > 0) m.v[i] = 0;
      }
      if (m.d[i] < -r * 0.94) {
        m.d[i] = -r * 0.94;
        m.v[i] = 0;
      }
    }
  }
  return {
    points: Array.from({ length: N }, (_, i) => ({
      x: size / 2 + dx + cos[i] * Math.max(2, r + m.d[i]),
      y: size / 2 + dy + sin[i] * Math.max(2, r + m.d[i]),
    })),
    dx,
    dy,
  };
}
export function smoothMembrane(points: readonly Point[]) {
  let path = '';
  const flat: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const prev = points[(i + points.length - 1) % points.length],
      p = points[i],
      next = points[(i + 1) % points.length],
      a = { x: (prev.x + p.x) / 2, y: (prev.y + p.y) / 2 },
      z = { x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 };
    if (!i) path = `M${a.x.toFixed(2)},${a.y.toFixed(2)}`;
    path += `Q${p.x.toFixed(2)},${p.y.toFixed(2)} ${z.x.toFixed(2)},${z.y.toFixed(2)}`;
    for (let k = 0; k < 2; k++) {
      const t = k / 2,
        u = 1 - t;
      flat.push({
        x: u * u * a.x + 2 * u * t * p.x + t * t * z.x,
        y: u * u * a.y + 2 * u * t * p.y + t * t * z.y,
      });
    }
  }
  return { path: path + 'Z', flat };
}
