import { useEffect, useId, useState } from 'react';
import { useHoldGesture } from './useHoldGesture';
import { motion } from 'motion/react';
import {
  BUBBLE_SIZE,
  URGENCY_LABEL,
  bubbleOutline,
  polygonPath,
  groupColor,
  type Task,
} from '@todopop/shared';
import { useTaskStore } from '../store/taskStore';
import { useMembrane } from './useMembrane';
import { PopDrops } from './PopDrops';
export function Bubble({ task, popping }: { task: Task; popping: boolean }) {
  const state = useTaskStore();
  const paintId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [reduced, setReduced] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => setReduced(query.matches);
    query.addEventListener('change', changed);
    return () => query.removeEventListener('change', changed);
  }, []);
  const [hover, setHover] = useState(false);
  const gesture = useHoldGesture(
    {
      open: () => void state.run(() => window.todopop.open(task.id)),
      edit: () => void state.run(() => window.todopop.edit(task.id)),
      pop: () => void state.run(() => window.todopop.act(task.id, 'complete')),
      start: (x, y) => window.todopop.drag('start', x, y),
      move: (x, y) => window.todopop.drag('move', x, y),
      end: (x, y) => window.todopop.drag('end', x, y),
    },
    popping || state.focus !== 'NORMAL',
  );
  const size = task.size || BUBBLE_SIZE[task.urgency];
  const group = state.groups.find((g) => g.id === task.groupId);
  const color = group ? groupColor(group.color, state.settings.tint) : state.settings.tint;
  const peers = state.tasks.filter((t) => !t.completed && !t.deletedAt);
  // The membrane owns these DOM paths after mounting. React must not reset
  // them to the static outline on every growth/state broadcast.
  const [initialShape] = useState(() => {
    const points = bubbleOutline(task, peers);
    return {
      path: polygonPath(points),
      clip: `polygon(${points.map((p) => `${(p.x / size) * 100}% ${(p.y / size) * 100}%`).join(',')})`,
    };
  });
  const membrane = useMembrane(
    task,
    peers,
    state.obstacles,
    !popping && state.focus === 'NORMAL',
    Boolean(reduced),
    gesture.moving,
    () => gesture.pressure.current,
  );
  return (
    <div
      className="organic-bubble"
      data-holding={gesture.holding}
      data-reduced-motion={reduced}
      style={{
        width: size,
        height: size,
        opacity: 1,
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
          animate={popping ? { opacity: 0, scale: 1 } : { opacity: 1, scale: 1 }}
          style={{ transformOrigin: '50% 50%' }}
          transition={{ duration: reduced ? 0.1 : 0.2 }}
        >
          <path
            ref={membrane.body}
            d={initialShape.path}
            fill={color}
            fillOpacity={
              task.urgency === 1
                ? 0.14
                : Math.min(0.28, 0.18 + Math.max(0, size * 0.305 - 42) / 1800)
            }
            stroke="var(--ink)"
            strokeOpacity={hover ? 0.65 : 0.3}
            strokeWidth={hover ? 1.5 : 1}
            vectorEffect="non-scaling-stroke"
          />
          <use href={`#${paintId}-surface`} fill={`url(#${paintId}-depth)`} stroke="none" />
          <use href={`#${paintId}-surface`} fill={`url(#${paintId}-shell)`} stroke="none" />
          <use href={`#${paintId}-surface`} fill={`url(#${paintId}-gloss)`} stroke="none" />
          <use
            href={`#${paintId}-surface`}
            fill="none"
            stroke={`url(#${paintId}-rim)`}
            strokeWidth={Math.max(1.2, Math.min(3.5, size * 0.007))}
            vectorEffect="non-scaling-stroke"
          />
        </motion.g>
        <defs>
          <path id={`${paintId}-surface`} ref={membrane.surface} d={initialShape.path} />
          <radialGradient id={`${paintId}-depth`} cx="42%" cy="30%" r="72%">
            <stop offset="0" stopColor="white" stopOpacity="0.03" />
            <stop offset="0.52" stopColor={color} stopOpacity="0" />
            <stop offset="0.8" stopColor="#1b3045" stopOpacity="0.07" />
            <stop offset="1" stopColor="#102338" stopOpacity="0.18" />
          </radialGradient>
          <radialGradient id={`${paintId}-shell`} cx="50%" cy="49%" r="51%">
            <stop offset="0" stopColor="white" stopOpacity="0" />
            <stop offset="0.67" stopColor="white" stopOpacity="0" />
            <stop offset="0.86" stopColor="white" stopOpacity="0.035" />
            <stop offset="0.96" stopColor="white" stopOpacity="0.17" />
            <stop offset="1" stopColor="white" stopOpacity="0.32" />
          </radialGradient>
          <radialGradient
            id={`${paintId}-gloss`}
            cx="0"
            cy="0"
            r="1"
            gradientTransform="translate(0.38 0.15) rotate(-25) scale(0.4 0.10)"
          >
            <stop offset="0" stopColor="white" stopOpacity="0.6" />
            <stop offset="0.55" stopColor="white" stopOpacity="0.24" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${paintId}-rim`} x1="18%" y1="0" x2="82%" y2="100%">
            <stop offset="0" stopColor="white" stopOpacity="0.85" />
            <stop offset="0.28" stopColor="white" stopOpacity="0.42" />
            <stop offset="0.5" stopColor={color} stopOpacity="0.15" />
            <stop offset="0.74" stopColor="white" stopOpacity="0.12" />
            <stop offset="1" stopColor="white" stopOpacity="0.55" />
          </linearGradient>
        </defs>
      </svg>
      <button
        ref={membrane.hit}
        className="organic-hit"
        aria-label={`Open ${task.title}`}
        aria-description="Click to open. Hold to pop. Right-click to edit. F2 also edits."
        style={{
          clipPath: initialShape.clip,
        }}
        {...gesture.handlers}
        onMouseEnter={() => {
          setHover(true);
          window.todopop.hit(true);
        }}
        onMouseLeave={() => {
          setHover(false);
          if (!gesture.holding && !gesture.moving()) window.todopop.hit(false);
        }}
      >
        <span
          ref={membrane.label}
          className="organic-label"
          data-compact={task.label?.compact || false}
          style={{
            fontSize: task.label?.fontSize || Math.max(10, Math.min(24, size * 0.052)),
            width: task.label?.width || Math.min(300, size * 0.42),
            left: task.label ? task.label.x - (task.position?.x || 0) : '50%',
            top: task.label ? task.label.y - (task.position?.y || 0) : '50%',
            opacity: popping ? 0 : 1,
          }}
        >
          <span className="organic-title" title={task.title}>
            {task.title}
          </span>
          {!task.label?.compact && task.urgency > 1 && <small>{URGENCY_LABEL[task.urgency]}</small>}
          {group ? (
            <span className="bubble-group-tag">
              <i style={{ background: color }} />
              <span>{group.name}</span>
            </span>
          ) : (
            !task.label?.compact && (
              <span className="bubble-date" title={new Date().toLocaleDateString()}>
                {new Date().getDate()}
              </span>
            )
          )}
        </span>
      </button>
      {popping && !reduced && <PopDrops size={size} />}
    </div>
  );
}
