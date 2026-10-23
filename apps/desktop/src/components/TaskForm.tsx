import { useEffect, useState } from 'react';
import { Button, TextInput } from '@todopop/ui';
import { groupColor, type Task, type Urgency } from '@todopop/shared';
import { UrgencyPicker } from './UrgencyPicker';
import { useTaskStore } from '../store/taskStore';
export function TaskForm({ task, onDone }: { task?: Task; onDone(): void }) {
  const draft = useTaskStore.getState().draft;
  const [title, setTitle] = useState(task?.title ?? draft.title);
  const [url, setUrl] = useState(task ? task.url || '' : draft.url || '');
  const [urgency, setUrgency] = useState<Urgency>(task?.urgency ?? draft.urgency);
  const [groupId, setGroupId] = useState<string | null>(
    task?.groupId ||
      (task?.group && task.group !== 'None' ? task.group : task ? null : draft.groupId || null),
  );
  const groups = useTaskStore((s) => s.groups);
  useEffect(() => {
    if (groupId && !groups.some((g) => g.id === groupId)) setGroupId(null);
  }, [groups, groupId]);
  const tint = useTaskStore((s) => s.settings.tint);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!task) useTaskStore.setState({ draft: { title, url, urgency, groupId } });
  }, [task, title, url, urgency, groupId]);
  const run = useTaskStore((s) => s.run);
  return (
    <form
      className="task-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        const input = { title, url, urgency, groupId };
        const ok = await run(() =>
          task ? window.todopop.update(task.id, input) : window.todopop.create(input),
        );
        setBusy(false);
        if (ok) {
          if (!task)
            useTaskStore.setState({ draft: { title: '', url: '', urgency: 1, groupId: null } });
          onDone();
        }
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
          <button
            type="button"
            aria-pressed={!groupId}
            className={!groupId ? 'selected' : ''}
            onClick={() => setGroupId(null)}
          >
            <i />
            No group
          </button>
          {groups.map((g) => (
            <button
              type="button"
              key={g.id}
              aria-pressed={groupId === g.id}
              className={groupId === g.id ? 'selected' : ''}
              onClick={() => setGroupId(g.id)}
            >
              <i style={{ background: groupColor(g.color, tint) }} />
              {g.name}
            </button>
          ))}
          <button
            hidden={Boolean(task)}
            type="button"
            className="new-group"
            onClick={() => window.dispatchEvent(new CustomEvent('manage-groups'))}
          >
            + New
          </button>
        </div>
      </fieldset>
      {task && (
        <button
          type="button"
          className="pill"
          onClick={() => {
            void run(async () => {
              await window.todopop.open(task.id);
              if (!task.url) onDone();
            });
          }}
        >
          {task.url ? '◯  Open work page' : 'Enter the bubble'}
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
