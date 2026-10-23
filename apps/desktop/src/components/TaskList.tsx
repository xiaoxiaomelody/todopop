import { useState } from 'react';
import { URGENCY_LABEL, GROUP_COLOR, type Task } from '@todopop/shared';
import { useTaskStore } from '../store/taskStore';
import popIcon from '../assets/a40db.svg';
import grip from '../assets/6e302.svg';
export function TaskList({
  tasks,
  archived = false,
  onEdit,
}: {
  tasks: Task[];
  archived?: boolean;
  onEdit(id: string): void;
}) {
  const run = useTaskStore((s) => s.run);
  const [popping, setPopping] = useState<string | null>(null);
  if (!tasks.length)
    return (
      <p className="empty">
        {archived
          ? 'A little space for your little wins.'
          : 'Nothing floating. Blow your first bubble.'}
      </p>
    );
  return (
    <ul className="task-list">
      {[...tasks]
        .sort((a, b) =>
          archived ? (b.completedAt || 0) - (a.completedAt || 0) : b.urgency - a.urgency,
        )
        .map((task) => (
          <li className={popping === task.id ? 'popping-row' : ''} key={task.id}>
            <img src={grip} width="12" height="22" alt="" className="row-grip" />
            <span
              className="task-dot"
              style={{
                background: GROUP_COLOR[task.group || 'None'],
                width: 12 + task.urgency * 3,
                height: 12 + task.urgency * 3,
              }}
            />
            <button
              className="task-name"
              onClick={() =>
                archived ? void run(() => window.todopop.act(task.id, 'restore')) : onEdit(task.id)
              }
            >
              <span>{task.title}</span>
              <small>
                {archived
                  ? 'Popped · click to re-bubble'
                  : task.snoozedUntil && task.snoozedUntil > Date.now()
                    ? 'Snoozed · 10 min'
                    : `${URGENCY_LABEL[task.urgency]}${task.url ? ' · URL linked' : ''}`}
              </small>
            </button>
            <button
              className="icon-button row-action"
              title={archived ? 'Re-bubble' : 'Pop task'}
              aria-label={`${archived ? 'Restore' : 'Complete'} ${task.title}`}
              onClick={async () => {
                if (popping) return;
                setPopping(task.id);
                await new Promise((r) => setTimeout(r, 220));
                await run(() => window.todopop.act(task.id, archived ? 'restore' : 'complete'));
                setPopping(null);
              }}
            >
              {archived ? '↺' : <img src={popIcon} width="30" height="30" alt="" />}
            </button>
          </li>
        ))}
    </ul>
  );
}
