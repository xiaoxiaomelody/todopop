import { useEffect, useRef } from 'react';
import { TaskForm } from '../components/TaskForm';
import { useTaskStore } from '../store/taskStore';
export function EditPopover({ id }: { id: string }) {
  const task = useTaskStore((s) => s.tasks.find((t) => t.id === id));
  const problem = useTaskStore((s) => s.problem);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const o = new ResizeObserver(() =>
      window.todopop.resizeEdit(ref.current!.getBoundingClientRect().height + 28),
    );
    o.observe(ref.current);
    return () => o.disconnect();
  }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') window.todopop.closeEdit();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  return (
    <div className="edit-shell">
      <div className="edit-panel" ref={ref}>
        <div className="edit-header">
          <h1 className="eyebrow">Edit bubble</h1>
          <button
            className="icon-button"
            aria-label="Close edit"
            onClick={() => window.todopop.closeEdit()}
          >
            ×
          </button>
        </div>
        {task ? (
          <TaskForm key={task.id} task={task} onDone={() => window.todopop.closeEdit()} />
        ) : (
          <p className="hint">Loading bubble…</p>
        )}
        {problem && (
          <p className="error" role="alert">
            {problem}
          </p>
        )}
      </div>
    </div>
  );
}
