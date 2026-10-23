import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { hexToHsv, hsvToHex } from '@todopop/shared';
import ring from '../assets/figma/hue-ring.png';
import knob from '../assets/figma/hue-knob.svg';
export function RingColorPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (hex: string) => void;
  label: string;
}) {
  const [color, setColor] = useState(hexToHsv(value)),
    [hex, setHex] = useState(value);
  const current = useRef(color),
    dragging = useRef(false);
  useEffect(() => {
    if (!dragging.current) {
      const c = hexToHsv(value);
      setColor(c);
      current.current = c;
      setHex(value);
    }
  }, [value]);
  const update = (c: typeof color, commit = false) => {
    current.current = c;
    setColor(c);
    const next = hsvToHex(c.h, c.s, c.v);
    setHex(next);
    if (commit) onChange(next);
  };
  function hue(e: PointerEvent<HTMLDivElement>) {
    const b = e.currentTarget.getBoundingClientRect(),
      x = e.clientX - b.x - 75,
      y = e.clientY - b.y - 75;
    if (Math.hypot(x, y) < 28) return;
    update({ ...current.current, h: ((Math.atan2(y, x) * 180) / Math.PI + 420) % 360 });
  }
  const theta = ((color.h - 60) * Math.PI) / 180;
  return (
    <div className="ring-picker" data-node-id="95:4381">
      <div className="ring-picker-row">
        <div
          className="hue-ring"
          role="slider"
          aria-label={`${label} hue`}
          aria-valuemin={0}
          aria-valuemax={359}
          aria-valuenow={Math.round(color.h)}
          tabIndex={0}
          onPointerDown={(e) => {
            dragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            hue(e);
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) hue(e);
          }}
          onPointerUp={() => {
            dragging.current = false;
            onChange(hsvToHex(current.current.h, current.current.s, current.current.v));
          }}
          onPointerCancel={() => {
            dragging.current = false;
            onChange(hsvToHex(current.current.h, current.current.s, current.current.v));
          }}
          onKeyDown={(e) => {
            let h = color.h;
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') h += e.shiftKey ? 10 : 1;
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') h -= e.shiftKey ? 10 : 1;
            else if (e.key === 'Home') h = 0;
            else if (e.key === 'End') h = 359;
            else return;
            e.preventDefault();
            update({ ...color, h: (h + 360) % 360 }, true);
          }}
        >
          <img src={ring} width="150" height="150" alt="" />
          <span
            className="hue-knob"
            style={{ left: 75 + Math.cos(theta) * 66 - 10, top: 75 + Math.sin(theta) * 66 - 10 }}
          >
            <img src={knob} width="20" height="20" alt="" />
            <i style={{ background: hsvToHex(color.h, 1, 1) }} />
          </span>
        </div>
        <div
          className="saturation-wrap"
          style={{
            background: `linear-gradient(to top, ${hsvToHex(color.h, 0, color.v)}, ${hsvToHex(color.h, 1, color.v)})`,
          }}
        >
          <input
            type="range"
            aria-label={`${label} saturation`}
            min="0"
            max="100"
            value={Math.round(color.s * 100)}
            onPointerDown={() => {
              dragging.current = true;
            }}
            onChange={(e) =>
              update({ ...current.current, s: Number(e.target.value) / 100 }, !dragging.current)
            }
            onPointerUp={() => {
              dragging.current = false;
              onChange(hsvToHex(current.current.h, current.current.s, current.current.v));
            }}
            onPointerCancel={() => {
              dragging.current = false;
              onChange(hsvToHex(current.current.h, current.current.s, current.current.v));
            }}
          />
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
            if (/^#[0-9a-f]{6}$/i.test(hex)) {
              update(hexToHsv(hex), true);
            } else setHex(value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />
      </label>
      <p className="picker-caption">Top of the bar: each hue at its most intense.</p>
    </div>
  );
}
