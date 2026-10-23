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
) {
  const body = useRef<SVGPathElement>(null),
    inner = useRef<SVGPathElement>(null),
    hit = useRef<HTMLButtonElement>(null),
    label = useRef<HTMLSpanElement>(null),
    latest = useRef({ task, peers, obstacles, reduced, dragging }),
    mouse = useRef({ x: -9999, y: -9999, vx: 0, vy: 0 });
  latest.current = { task, peers, obstacles, reduced, dragging };
  useEffect(() => {
    if (!active) return;
    const m = createMembrane();
    let frame = 0,
      last = performance.now(),
      sent = 0;
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
        next.dragging() || close
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
        curve = smoothMembrane(shape.points);
      body.current?.setAttribute('d', curve.path);
      inner.current?.setAttribute('d', curve.path);
      if (hit.current) hit.current.style.clipPath = `path('${curve.path}')`;
      if (label.current)
        label.current.style.transform = `translate(-50%,-50%) translate(${shape.dx}px,${shape.dy}px)`;
      mouse.current.vx *= 0.82;
      mouse.current.vy *= 0.82;
      if (now - sent > 250) {
        sent = now;
        window.todopop.contour(p.task.size || 118, curve.flat);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('mousemove', move);
    };
  }, [task.id, active]);
  return { body, inner, hit, label };
}
