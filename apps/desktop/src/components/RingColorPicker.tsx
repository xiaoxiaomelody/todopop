import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { designerInk, hexHsl, okHue, vividColor, defaultWheelSat } from '@todopop/shared';
export function RingColorPicker({
  value,
  onChange,
  label,
  mode = 'tint',
  wheel,
  onWheelChange,
}: {
  value: string;
  onChange: (hex: string) => void;
  label: string;
  mode?: 'tint' | 'group';
  wheel?: { h: number; s: number };
  onWheelChange?: (v: { h: number; s: number }) => void;
}) {
  const infer = () =>
    wheel ||
    (mode === 'tint' ? hexHsl(value) : { h: okHue(value), s: defaultWheelSat(okHue(value)) });
  const [color, setColor] = useState(infer),
    [hex, setHex] = useState(value),
    current = useRef(color),
    drag = useRef(false);
  useEffect(() => {
    if (!drag.current) {
      const next = infer();
      current.current = next;
      setColor(next);
      setHex(value);
    }
  }, [value, wheel?.h, wheel?.s, mode]);
  const at = (h: number, s: number) => (mode === 'tint' ? designerInk(h, s) : vividColor(h, s));
  function update(c: { h: number; s: number }, commit = false) {
    c = { h: ((c.h % 360) + 360) % 360, s: Math.max(0, Math.min(1, c.s)) };
    current.current = c;
    setColor(c);
    setHex(at(c.h, c.s));
    if (commit) {
      if (onWheelChange) onWheelChange(c);
      else onChange(at(c.h, c.s));
    }
  }
  function pick(e: PointerEvent<HTMLElement>, sat = false) {
    const r = e.currentTarget.getBoundingClientRect();
    if (sat) update({ ...current.current, s: 1 - (e.clientY - r.y) / r.height });
    else
      update({
        ...current.current,
        h:
          (Math.atan2(e.clientX - r.x - r.width / 2, -(e.clientY - r.y - r.height / 2)) * 180) /
          Math.PI,
      });
  }
  function start(e: PointerEvent<HTMLElement>, sat = false) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    drag.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus({ preventScroll: true });
    pick(e, sat);
  }
  function finish(e: PointerEvent<HTMLElement>) {
    e.stopPropagation();
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current = false;
    update(current.current, true);
  }
  const gradient = Array.from(
    { length: 37 },
    (_, i) => `${at((i * 10) % 360, color.s)} ${i * 10}deg`,
  ).join(',');
  const bar = Array.from(
    { length: 9 },
    (_, i) => `${at(color.h, 1 - i / 8)} ${(i / 8) * 100}%`,
  ).join(',');
  const key = (e: React.KeyboardEvent, sat = false) => {
    const d = e.shiftKey ? 10 : 1;
    let h = color.h,
      s = color.s;
    if (['ArrowRight', 'ArrowUp'].includes(e.key)) {
      if (sat) s += d / 100;
      else h += d;
    } else if (['ArrowLeft', 'ArrowDown'].includes(e.key)) {
      if (sat) s -= d / 100;
      else h -= d;
    } else if (e.key === 'Home') {
      if (sat) s = 0;
      else h = 0;
    } else if (e.key === 'End') {
      if (sat) s = 1;
      else h = 359;
    } else return;
    e.preventDefault();
    update({ h, s }, true);
  };
  return (
    <div className="ring-picker designer-picker" onDragStart={(e) => e.preventDefault()}>
      <div className="ring-picker-row">
        <div
          className="hue-ring generated-ring"
          role="slider"
          aria-label={`${label} hue`}
          aria-valuemin={0}
          aria-valuemax={359}
          aria-valuenow={Math.round(color.h) % 360}
          tabIndex={0}
          style={{ background: `conic-gradient(${gradient})` }}
          onPointerDown={(e) => start(e)}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) pick(e);
          }}
          onPointerUp={finish}
          onPointerCancel={finish}
          onKeyDown={(e) => key(e)}
        >
          <i
            className="generated-knob"
            style={{
              left: 75 + Math.sin((color.h * Math.PI) / 180) * 65,
              top: 75 - Math.cos((color.h * Math.PI) / 180) * 65,
              background: at(color.h, color.s),
            }}
          />
        </div>
        <div
          className="designer-sat"
          role="slider"
          tabIndex={0}
          aria-label={`${label} saturation`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(color.s * 100)}
          style={{ background: `linear-gradient(${bar})` }}
          onPointerDown={(e) => start(e, true)}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) pick(e, true);
          }}
          onPointerUp={finish}
          onPointerCancel={finish}
          onKeyDown={(e) => key(e, true)}
        >
          <i style={{ top: `${(1 - color.s) * 100}%`, background: at(color.h, color.s) }} />
        </div>
      </div>
      <label className="hex-field">
        <span className="eyebrow">HEX</span>
        <input
          aria-label={`${label} HEX`}
          value={hex.toUpperCase()}
          maxLength={7}
          onChange={(e) => setHex(e.target.value)}
          onBlur={() => {
            if (/^#[0-9a-f]{6}$/i.test(hex)) onChange(hex.toLowerCase());
            else setHex(value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />
      </label>
      <p className="picker-caption">
        {mode === 'tint'
          ? 'Every hue keeps your text readable.'
          : 'Top of the bar: each hue at its most intense.'}
      </p>
    </div>
  );
}
