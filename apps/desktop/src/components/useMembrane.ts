import { useEffect, useRef } from 'react';
import {
  createMembrane,
  membraneStep,
  smoothMembrane,
  type Task,
  type Rect,
} from '@todopop/shared';
export function useMembrane(
  task: Task,
  peers: Task[],
  obstacles: Rect[],
  active: boolean,
  reduced: boolean,
  dragging: () => boolean,
  pressure: () => number,
) {
  const body = useRef<SVGPathElement>(null),
    hit = useRef<HTMLButtonElement>(null),
    label = useRef<HTMLSpanElement>(null),
    latest = useRef({ task, peers, obstacles, reduced, dragging, pressure }),
    mouse = useRef({ x: -9999, y: -9999, vx: 0, vy: 0 });
  latest.current = { task, peers, obstacles, reduced, dragging, pressure };
  useEffect(() => {
    if (!active) return;
    const m = createMembrane();
    let frame = 0,
      last = performance.now(),
      sent = 0,
      charge = 0;
    const move = (e: MouseEvent) => {
      const old = mouse.current;
      mouse.current = {
        x: e.screenX,
        y: e.screenY,
        vx: Math.abs(e.screenX - old.x) > 100 ? 0 : e.screenX - old.x,
        vy: Math.abs(e.screenY - old.y) > 100 ? 0 : e.screenY - old.y,
      };
    };
    window.addEventListener('mousemove', move);
    const tick = (now: number) => {
      const next = latest.current,
        close =
          Math.hypot(
            mouse.current.x - ((next.task.position?.x || 0) + (next.task.size || 118) / 2),
            mouse.current.y - ((next.task.position?.y || 0) + (next.task.size || 118) / 2),
          ) <
          (next.task.size || 118) * 0.305 + 90;
      const hz =
        next.dragging() || next.pressure() > 0 || charge > 0.01 || close
          ? 60
          : next.peers.length > 24
            ? 15
            : next.peers.length > 12
              ? 30
              : 60;
      if (now - last < 1000 / hz - 1) {
        frame = requestAnimationFrame(tick);
        return;
      }
      const p = latest.current,
        dt = (now - last) / 1000;
      last = now;
      const shape = membraneStep(
          m,
          p.task,
          p.peers,
          p.obstacles,
          dt,
          mouse.current,
          p.dragging(),
          p.reduced,
        ),
        base = smoothMembrane(shape.points);
      charge += (p.pressure() - charge) * Math.min(1, dt * 18);
      const size = p.task.size || 118,
        center = size / 2;
      const scale = 1;
      const shake = p.reduced ? 0 : charge * charge * Math.min(1.5, size * 0.004);
      const dx = Math.sin(now * 0.075) * shake,
        dy = Math.cos(now * 0.091) * shake;
      const curve =
        charge > 0.001
          ? smoothMembrane(
              shape.points.map((point, i) => {
                const angle = Math.atan2(point.y - center, point.x - center);
                const wave = p.reduced
                  ? 0
                  : Math.sin(i * 1.8 + now * 0.065) * charge * charge * Math.min(2, size * 0.004);
                return {
                  x: center + (point.x - center) * scale + Math.cos(angle) * wave + dx,
                  y: center + (point.y - center) * scale + Math.sin(angle) * wave + dy,
                };
              }),
            )
          : base;
      body.current?.setAttribute('d', curve.path);
      if (hit.current) hit.current.style.clipPath = `path('${curve.path}')`;
      if (label.current) label.current.style.transform = 'translate(-50%,-50%)';
      mouse.current.vx *= 0.82;
      mouse.current.vy *= 0.82;
      if (now - sent > 250) {
        sent = now;
        window.todopop.contour(p.task.size || 118, base.flat);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('mousemove', move);
    };
  }, [task.id, active]);
  return { body, hit, label };
}
