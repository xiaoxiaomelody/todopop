import { useRef, useState, type PointerEvent, type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { BUBBLE_SIZE, URGENCY_LABEL, groupColor, hexHue, type Task } from '@todopop/shared';
import { useTaskStore } from '../store/taskStore';
import bodyS from '../assets/5a58f.svg';
import bodyM from '../assets/3b683.svg';
import bodyL from '../assets/50713.svg';
import bodyXL from '../assets/84779.svg';
import ringL from '../assets/18192.svg';
import ringXL from '../assets/2169a.svg';
import drop from '../assets/f1486.svg';
const bodies = { 1: bodyS, 2: bodyM, 3: bodyL, 4: bodyXL };
const geo = {
  1: { x: 22.72, y: 21.93, width: 73.4699, height: 73.4964, label: 9, labelWidth: 52 },
  2: { x: 37.97, y: 36.72, width: 117.514, height: 117.551, label: 11.5, labelWidth: 84 },
  3: { x: 59.26, y: 57.38, width: 181.574, height: 181.634, label: 16, labelWidth: 131 },
  4: { x: 88.66, y: 85.76, width: 272.065, height: 272.15, label: 23, labelWidth: 196 },
};
export function Bubble({ task, popping }: { task: Task; popping: boolean }) {
  const groups = useTaskStore((s) => s.groups);
  const tint = useTaskStore((s) => s.settings.tint);
  const paused = useTaskStore((s) => s.paused);
  const group = groups.find((g) => g.id === task.groupId);
  const ratio = (task.size || BUBBLE_SIZE[task.urgency]) / BUBBLE_SIZE[task.urgency];
  const reduced = useReducedMotion();
  const [hover, setHover] = useState(false);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const run = useTaskStore((s) => s.run);
  const g = geo[task.urgency],
    size = BUBBLE_SIZE[task.urgency];
  function down(e: PointerEvent) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.screenX, y: e.screenY, moved: false };
    window.todopop.drag('start', e.screenX, e.screenY);
  }
  function move(e: PointerEvent) {
    if (!drag.current) return;
    if (Math.hypot(e.screenX - drag.current.x, e.screenY - drag.current.y) > 4)
      drag.current.moved = true;
    if (drag.current.moved) window.todopop.drag('move', e.screenX, e.screenY);
  }
  function up(e: PointerEvent) {
    if (!drag.current) return;
    const moved = drag.current.moved;
    drag.current = null;
    window.todopop.drag('end', e.screenX, e.screenY);
    if (!moved) void run(() => window.todopop.open(task.id));
  }
  return (
    <div
      className={`bubble-canvas ${paused ? 'is-paused' : ''}`}
      style={{ width: size * ratio, height: size * ratio } as CSSProperties}
    >
      <div
        className="bubble-scale"
        style={{
          width: size,
          height: size,
          transform: `scale(${ratio})`,
          transformOrigin: 'top left',
        }}
      >
        <motion.div
          className="bubble-art"
          animate={
            popping
              ? { scale: [1, 1.13, 0.2], opacity: [1, 1, 0] }
              : reduced
                ? { y: 0, opacity: 1, scale: 1 }
                : { y: [0, -3, 0], opacity: 1, scale: 1 }
          }
          transition={
            popping ? { duration: 0.32 } : { duration: 4.8, repeat: Infinity, ease: 'easeInOut' }
          }
        >
          <motion.div
            className="bubble-shape"
            animate={
              hover && !popping
                ? { scaleX: 1.045, scaleY: 0.96, rotate: -1 }
                : { scaleX: 1, scaleY: 1, rotate: 0 }
            }
            transition={{ type: 'spring', stiffness: 300, damping: 9 }}
          >
            <img
              src={bodies[task.urgency]}
              alt=""
              width={g.width}
              height={g.height}
              style={{
                position: 'absolute',
                left: g.x,
                top: g.y,
                filter: `hue-rotate(${hexHue(tint) - hexHue('#1a419e')}deg)`,
                opacity: paused ? 0.6 : 1,
              }}
            />
            {task.urgency >= 3 && (
              <img
                src={task.urgency === 3 ? ringL : ringXL}
                alt=""
                width={task.urgency === 3 ? 169.057 : 259.154}
                height={task.urgency === 3 ? 169.118 : 259.235}
                style={{
                  position: 'absolute',
                  left: task.urgency === 3 ? 65.19 : 95.04,
                  top: task.urgency === 3 ? 63.68 : 92.23,
                }}
              />
            )}
            {group && (
              <div
                className="bubble-group-ring"
                style={{
                  position: 'absolute',
                  left: g.x + 4,
                  top: g.y + 4,
                  width: g.width - 8,
                  height: g.height - 8,
                  borderColor: groupColor(group.color, tint),
                  backgroundColor: groupColor(group.color, tint),
                }}
              />
            )}
            {paused && (
              <div
                className="paused-ring"
                style={{ left: g.x, top: g.y, width: g.width, height: g.height }}
              />
            )}
            <div
              className="bubble-label"
              style={{ width: g.labelWidth, fontSize: g.label / Math.sqrt(ratio) }}
            >
              <span>{task.title}</span>
              {task.urgency > 1 && <small>{URGENCY_LABEL[task.urgency]}</small>}
            </div>
          </motion.div>
        </motion.div>
        {popping &&
          Array.from({ length: 10 }, (_, i) => (
            <motion.img
              key={i}
              src={drop}
              alt=""
              width="6"
              height="6"
              className="pop-drop"
              initial={{ x: 0, y: 0, opacity: 1 }}
              animate={{
                x: Math.cos((i * Math.PI) / 5) * size * 0.32,
                y: Math.sin((i * Math.PI) / 5) * size * 0.32,
                opacity: 0,
              }}
              transition={{ duration: 0.35 }}
            />
          ))}
        <div
          className="bubble-hit"
          style={{ left: g.x, top: g.y, width: g.width, height: g.height }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={(e) => {
            drag.current = null;
            window.todopop.drag('end', e.screenX, e.screenY);
          }}
          onMouseEnter={() => {
            setHover(true);
            window.todopop.hit(true);
          }}
          onMouseLeave={() => {
            if (!drag.current) {
              setHover(false);
              window.todopop.hit(false);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            void run(() => window.todopop.edit(task.id));
          }}
        >
          <button
            className="bubble-keyboard"
            aria-label={`Open ${task.title}`}
            onClick={(e) => {
              if (e.detail === 0) void run(() => window.todopop.open(task.id));
            }}
          />
          <div
            className="bubble-tools"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            <button
              title="Snooze for 10 minutes"
              aria-label="Snooze task"
              onClick={() => {
                void run(() => window.todopop.act(task.id, 'snooze'));
              }}
            >
              z
            </button>
            <button
              title="Edit task"
              aria-label="Edit task"
              onClick={() => {
                void run(() => window.todopop.edit(task.id));
              }}
            >
              ···
            </button>
            <button
              title="Pop task"
              aria-label="Complete task"
              onClick={() => {
                void run(() => window.todopop.act(task.id, 'complete'));
              }}
            >
              ✓
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
