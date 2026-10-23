import { useState } from 'react';
import { Button, TextInput } from '@todopop/ui';
import { GROUP_COLOR, type Group, type Task, type Urgency } from '@todopop/shared';
import { UrgencyPicker } from './UrgencyPicker';
import { useTaskStore } from '../store/taskStore';
export function TaskForm({ task, onDone }: { task?: Task; onDone(): void }) {
  const [title, setTitle] = useState(task?.title || '');
  const [url, setUrl] = useState(task?.url || '');
  const [urgency, setUrgency] = useState<Urgency>(task?.urgency || 1);
  const [group, setGroup] = useState<Group>(task?.group || 'None');
  const [busy, setBusy] = useState(false);
  const run = useTaskStore((s) => s.run);
  return (
    <form
      className="task-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        const input = { title, url, urgency, group };
        const ok = await run(() =>
          task ? window.todopop.update(task.id, input) : window.todopop.create(input),
        );
        setBusy(false);
        if (ok) onDone();
      }}
    >
      <label>
        <span className="eyebrow">Task name</span>
        <TextInput
          name="title"
          autoFocus
          required
          maxLength={120}
          placeholder="What’s on your mind?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label>
        <span className="eyebrow">
          Work URL <span className="optional">Optional</span>
        </span>
        <TextInput
          name="url"
          type="url"
          maxLength={4096}
          placeholder="https://your-work-page.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </label>
      <UrgencyPicker value={urgency} onChange={setUrgency} />
      <fieldset className="group-picker">
        <legend className="eyebrow">Group</legend>
        <div className="chips">
          {(['None', 'School', 'Work', 'Life'] as Group[]).map((g) => (
            <button
              type="button"
              key={g}
              aria-pressed={group === g}
              className={group === g ? 'selected' : ''}
              onClick={() => setGroup(g)}
            >
              <i style={{ background: GROUP_COLOR[g] }} />
              {g === 'None' ? 'No group' : g}
            </button>
          ))}
        </div>
      </fieldset>
      {task?.url && (
        <button
          type="button"
          className="pill"
          onClick={() => {
            void run(() => window.todopop.open(task.id));
          }}
        >
          ◯ &nbsp; Get in the bubble
        </button>
      )}
      <div className="form-actions">
        {task && (
          <button
            type="button"
            className="text-button"
            onClick={async () => {
              if (await run(() => window.todopop.act(task.id, 'delete'))) onDone();
            }}
          >
            Delete
          </button>
        )}
        {task && (
          <button type="button" className="pill" onClick={onDone}>
            Cancel
          </button>
        )}
        <Button
          type="submit"
          disabled={busy || !title.trim()}
          className={task ? 'pill filled' : 'pill'}
          variant={task ? 'filled' : 'outline'}
        >
          {busy ? 'Saving…' : task ? 'Save' : 'Blow it'}
        </Button>
      </div>
    </form>
  );
}
