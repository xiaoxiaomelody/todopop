import { useState, type DragEvent } from 'react';
import { URGENCY_LABEL, groupColor, type Task } from '@todopop/shared';
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
  const state = useTaskStore(),
    [busy, setBusy] = useState<string | null>(null);
  const ordered = [...tasks].sort((a, b) =>
    archived ? (b.completedAt || 0) - (a.completedAt || 0) : (a.rank || 0) - (b.rank || 0),
  );
  async function move(id: string, before: string) {
    const ids = ordered.map((t) => t.id);
    const from = ids.indexOf(id),
      to = ids.indexOf(before);
    if (from < 0 || to < 0 || from === to) return;
    ids.splice(from, 1);
    ids.splice(to, 0, id);
    await state.run(() => window.todopop.reorder(ids));
  }
  function drop(e: DragEvent, id: string) {
    e.preventDefault();
    void move(e.dataTransfer.getData('text/plain'), id);
  }
  if (!tasks.length) return <p className="empty">Nothing floating. Blow your first bubble.</p>;
  return (
    <ul className="task-list">
      {ordered.map((task) => {
        const group = state.groups.find((g) => g.id === task.groupId);
        return (
          <li key={task.id} onDragOver={(e) => e.preventDefault()} onDrop={(e) => drop(e, task.id)}>
            <button
              type="button"
              className="row-grip-button"
              aria-label={`Reorder ${task.title}`}
              title="Drag to reorder, or use ↑ / ↓"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', task.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onKeyDown={(e) => {
                const index = ordered.indexOf(task);
                if (e.key === 'ArrowUp' && index > 0) {
                  e.preventDefault();
                  void move(task.id, ordered[index - 1].id);
                }
                if (e.key === 'ArrowDown' && index < ordered.length - 1) {
                  e.preventDefault();
                  void move(task.id, ordered[index + 1].id);
                }
              }}
            >
              <img src={grip} width="12" height="22" alt="" />
            </button>
            <span
              className="task-dot"
              style={{
                background: group ? groupColor(group.color, state.settings.tint) : 'transparent',
                width: 12 + task.urgency * 3,
                height: 12 + task.urgency * 3,
              }}
            />
            <button className="task-name" onClick={() => onEdit(task.id)}>
              <span>{task.title}</span>
              <small>
                {`${URGENCY_LABEL[task.urgency]} · ${Math.floor((task.growthMs || 0) / 60000)}m · ⌀ ${(((task.size || 118) * 0.61) / 37.8).toFixed(1)} cm`}
              </small>
            </button>
            <button
              className="icon-button row-action"
              disabled={busy === task.id}
              aria-label={`Complete ${task.title}`}
              title="Pop task"
              onClick={async () => {
                setBusy(task.id);
                await state.run(() => window.todopop.act(task.id, 'complete'));
                setBusy(null);
              }}
            >
              <img src={popIcon} width="30" height="30" alt="" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
