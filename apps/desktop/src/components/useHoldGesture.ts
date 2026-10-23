import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
export const HOLD_TO_POP_MS = 850;
export function useHoldGesture(
  actions: {
    open(): void;
    edit(): void;
    pop(): void;
    start?(x: number, y: number): void;
    move?(x: number, y: number): void;
    end?(x: number, y: number): void;
  },
  disabled = false,
) {
  const latest = useRef(actions);
  latest.current = actions;
  const pressure = useRef(0),
    gesture = useRef<{
      x: number;
      y: number;
      lastX: number;
      lastY: number;
      start: number;
      moved: boolean;
      fired: boolean;
    } | null>(null),
    frame = useRef(0),
    lastOpen = useRef(-Infinity);
  const [holding, setHolding] = useState(false);
  function cancel() {
    cancelAnimationFrame(frame.current);
    const g = gesture.current;
    if (g && !g.fired) latest.current.end?.(g.lastX, g.lastY);
    gesture.current = null;
    pressure.current = 0;
    setHolding(false);
  }
  function fire() {
    const g = gesture.current;
    if (!g || g.moved || g.fired) return;
    g.fired = true;
    pressure.current = 1;
    setHolding(false);
    latest.current.end?.(g.lastX, g.lastY);
    latest.current.pop();
  }
  function tick(now: number) {
    const g = gesture.current;
    if (!g || g.moved || g.fired) return;
    pressure.current = Math.min(1, (now - g.start) / HOLD_TO_POP_MS);
    if (pressure.current >= 1) fire();
    else frame.current = requestAnimationFrame(tick);
  }
  useEffect(() => {
    const stop = () => cancel();
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') cancel();
    };
    window.addEventListener('blur', stop);
    window.addEventListener('keydown', key);
    return () => {
      cancelAnimationFrame(frame.current);
      const g = gesture.current;
      if (g && !g.fired) latest.current.end?.(g.lastX, g.lastY);
      window.removeEventListener('blur', stop);
      window.removeEventListener('keydown', key);
    };
  }, []);
  useEffect(() => {
    if (disabled) cancel();
  }, [disabled]);
  return {
    holding,
    pressure,
    moving: () => Boolean(gesture.current?.moved),
    handlers: {
      onPointerDown(e: PointerEvent<HTMLButtonElement>) {
        if (e.button !== 0 || disabled) return;
        cancel();
        e.currentTarget.setPointerCapture(e.pointerId);
        gesture.current = {
          x: e.screenX,
          y: e.screenY,
          lastX: e.screenX,
          lastY: e.screenY,
          start: performance.now(),
          moved: false,
          fired: false,
        };
        latest.current.start?.(e.screenX, e.screenY);
        setHolding(true);
        frame.current = requestAnimationFrame(tick);
      },
      onPointerMove(e: PointerEvent<HTMLButtonElement>) {
        const g = gesture.current;
        if (!g || g.fired) return;
        g.lastX = e.screenX;
        g.lastY = e.screenY;
        if (Math.hypot(e.screenX - g.x, e.screenY - g.y) > 6) {
          g.moved = true;
          cancelAnimationFrame(frame.current);
          pressure.current = 0;
          setHolding(false);
        }
        if (g.moved) latest.current.move?.(e.screenX, e.screenY);
      },
      onPointerUp(e: PointerEvent<HTMLButtonElement>) {
        const g = gesture.current;
        if (!g || e.button !== 0) return;
        if (!g.moved && !g.fired && performance.now() - g.start >= HOLD_TO_POP_MS) fire();
        const open = !g.moved && !g.fired && !disabled && performance.now() - g.start < 250;
        cancel();
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
        if (open && performance.now() - lastOpen.current > 500) {
          lastOpen.current = performance.now();
          latest.current.open();
        }
      },
      onPointerCancel: () => cancel(),
      onLostPointerCapture: () => cancel(),
      onClick(e: MouseEvent<HTMLButtonElement>) {
        if (e.detail === 0 && !disabled) latest.current.open();
      },
      onContextMenu(e: MouseEvent<HTMLButtonElement>) {
        e.preventDefault();
        cancel();
        if (!disabled) latest.current.edit();
      },
      onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
        if (e.key === 'F2') {
          e.preventDefault();
          cancel();
          if (!disabled) latest.current.edit();
        }
        if (e.key === 'Escape') cancel();
      },
    },
  };
}
