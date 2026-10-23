import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  BUBBLE_SIZE,
  URGENCY_LABEL,
  bubbleOutline,
  polygonPath,
  groupColor,
  type Task,
} from '@todopop/shared';
import { useTaskStore } from '../store/taskStore';
import { PopDrops } from './PopDrops';
export function Bubble({ task, popping }: { task: Task; popping: boolean }) {
  const state = useTaskStore(),
    reduced = useReducedMotion();
  const [hover, setHover] = useState(false);
  const click = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const size = task.size || BUBBLE_SIZE[task.urgency];
  const group = state.groups.find((g) => g.id === task.groupId);
  const color = group ? groupColor(group.color, state.settings.tint) : state.settings.tint;
  const peers = state.tasks.filter(
    (t) => !t.completed && !t.deletedAt && !(t.snoozedUntil && t.snoozedUntil > Date.now()),
  );
  const points = bubbleOutline(task, peers),
    path = polygonPath(points);
  const faded = state.selectedGroupId && task.groupId !== state.selectedGroupId;
  const cancelClick = () => {
    if (click.current) clearTimeout(click.current);
    click.current = null;
  };
  useEffect(
    () => () => {
      if (click.current) clearTimeout(click.current);
    },
    [],
  );
  function down(e: PointerEvent) {
    if (e.button !== 0 || popping) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.screenX, y: e.screenY, moved: false };
    window.todopop.drag('start', e.screenX, e.screenY);
  }
  function move(e: PointerEvent) {
    if (!drag.current) return;
    if (Math.hypot(e.screenX - drag.current.x, e.screenY - drag.current.y) > 6) {
      drag.current.moved = true;
      cancelClick();
    }
    if (drag.current.moved) window.todopop.drag('move', e.screenX, e.screenY);
  }
  function up(e: PointerEvent) {
    if (!drag.current || e.button !== 0) return;
    const moved = drag.current.moved;
    drag.current = null;
    window.todopop.drag('end', e.screenX, e.screenY);
    if (moved || popping) return;
    if (click.current) {
      cancelClick();
      void state.run(() => window.todopop.edit(task.id));
    } else
      click.current = setTimeout(() => {
        click.current = null;
        void state.run(() => window.todopop.open(task.id));
      }, 350);
  }
  return (
    <div
      className="organic-bubble"
      style={{
        width: size,
        height: size,
        opacity: faded ? 0.38 : 1,
        transform: `translate(${task.renderOffset?.x || 0}px,${task.renderOffset?.y || 0}px)`,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
        className="organic-art"
      >
        <motion.g
          animate={popping ? { opacity: 0, scale: reduced ? 1 : 1.16 } : { opacity: 1, scale: 1 }}
          style={{ transformOrigin: '50% 50%' }}
          transition={{ duration: reduced ? 0.1 : 0.2 }}
        >
          <motion.path
            d={path}
            animate={{ d: path, strokeWidth: hover ? 1.8 : 1.5 }}
            transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 180, damping: 16 }}
            fill={color}
            fillOpacity={0.095}
            stroke="var(--ink)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          {task.urgency >= 3 && (
            <g
              transform={`translate(${size / 2} ${size / 2}) scale(.925) translate(${-size / 2} ${-size / 2})`}
            >
              <motion.path
                d={path}
                animate={{ d: path }}
                transition={
                  reduced ? { duration: 0 } : { type: 'spring', stiffness: 180, damping: 16 }
                }
                fill="none"
                stroke="var(--soft)"
                strokeWidth={1}
                strokeDasharray={task.urgency === 3 ? '3 7' : undefined}
                opacity={0.65}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          )}
        </motion.g>
      </svg>
      <motion.button
        className="organic-hit"
        aria-label={`Open ${task.title}`}
        aria-description="Click to open. Double-click to edit. Right-click to pop."
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 180, damping: 16 }}
        animate={{
          clipPath: `polygon(${points.map((p) => `${(p.x / size) * 100}% ${(p.y / size) * 100}%`).join(',')})`,
        }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={(e) => {
          drag.current = null;
          cancelClick();
          window.todopop.drag('end', e.screenX, e.screenY);
        }}
        onMouseEnter={() => {
          setHover(true);
          window.todopop.hit(true);
        }}
        onMouseLeave={() => {
          setHover(false);
          if (!drag.current) window.todopop.hit(false);
        }}
        onClick={(e) => {
          if (e.detail === 0 && !popping) void state.run(() => window.todopop.open(task.id));
        }}
        onKeyDown={(e) => {
          if (e.key === 'F2') {
            e.preventDefault();
            cancelClick();
            void state.run(() => window.todopop.edit(task.id));
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          cancelClick();
          if (!popping) void state.run(() => window.todopop.act(task.id, 'complete'));
        }}
      >
        <span
          className="organic-label"
          style={{
            fontSize: Math.max(10, Math.min(38, size * 0.052)),
            width: size * 0.46,
            opacity: popping ? 0 : 1,
          }}
        >
          <span>{task.title}</span>
          {task.urgency > 1 && <small>{URGENCY_LABEL[task.urgency]}</small>}
          <span className="bubble-date" title={new Date().toLocaleDateString()}>
            {new Date().getDate()}
          </span>
        </span>
      </motion.button>
      {popping && !reduced && <PopDrops size={size} />}
    </div>
  );
}
