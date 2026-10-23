import { useEffect } from 'react';
import { ActionGlyph, Button } from '@todopop/ui';
import { useTaskStore } from '../store/taskStore';
export function Billboard({ id }: { id: string }) {
  const s = useTaskStore(),
    task = s.tasks.find((t) => t.id === id);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void s.run(() => window.todopop.exitFocus());
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  return (
    <main
      className="billboard"
      aria-label="Task focus"
      onContextMenu={(e) => {
        e.preventDefault();
        if (task) void s.run(() => window.todopop.edit(id));
      }}
    >
      <header>
        <span className="eyebrow">IN THE BUBBLE</span>
        <button
          aria-label="Return to bubbles"
          onClick={() => void s.run(() => window.todopop.exitFocus())}
        >
          <ActionGlyph name="close" />
        </button>
      </header>
      <h1>{task?.title || 'Your task'}</h1>
      <p>One thing at a time.</p>
      <footer>
        <Button onClick={() => void s.run(() => window.todopop.exitFocus())}>Back · Esc</Button>
        <Button
          variant="filled"
          onClick={() => void s.run(() => window.todopop.act(id, 'complete'))}
        >
          Pop · Done
        </Button>
      </footer>
      {s.problem && <p role="alert">{s.problem}</p>}
    </main>
  );
}
