import { useState } from 'react';
import { Button } from '@todopop/ui';
import { dayKey, historySummary, URGENCY_LABEL } from '@todopop/shared';
import { useTaskStore } from '../store/taskStore';
function minutes(ms: number) {
  return `${Math.round(ms / 60000)} min`;
}
export function Archive() {
  const s = useTaskStore(),
    [view, setView] = useState<'week' | 'month'>('week'),
    [anchor, setAnchor] = useState(new Date()),
    [selected, setSelected] = useState(dayKey(new Date())),
    [busy, setBusy] = useState<string | null>(null);
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  if (view === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  else start.setDate(1);
  const end = new Date(start);
  if (view === 'week') end.setDate(end.getDate() + 7);
  else end.setMonth(end.getMonth() + 1);
  const summary = historySummary(s.history, start.getTime(), end.getTime());
  const days = [];
  const grid = new Date(start);
  if (view === 'month') grid.setDate(grid.getDate() - ((grid.getDay() + 6) % 7));
  for (let i = 0; i < (view === 'week' ? 7 : 42); i++) {
    const d = new Date(grid);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  const best = Object.entries(summary.counts).sort((a, b) => b[1] - a[1])[0];
  const events = s.history
    .filter((e) => e.kind === 'completed' && dayKey(new Date(e.at)) === selected)
    .sort((a, b) => b.at - a.at);
  function shift(delta: number) {
    const next = new Date(anchor);
    if (view === 'week') next.setDate(next.getDate() + delta * 7);
    else {
      next.setDate(1);
      next.setMonth(next.getMonth() + delta);
    }
    setAnchor(next);
    setSelected(dayKey(next));
  }
  return (
    <div className="archive">
      <div className="archive-toolbar">
        <div className="segmented">
          {(['week', 'month'] as const).map((v) => (
            <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>
              {v.toUpperCase()}
            </button>
          ))}
        </div>
        <div>
          <button aria-label="Previous period" onClick={() => shift(-1)}>
            ‹
          </button>
          <button aria-label="Next period" onClick={() => shift(1)}>
            ›
          </button>
        </div>
      </div>
      <p className="eyebrow period-label">
        {start.toLocaleDateString(undefined, {
          month: 'long',
          day: view === 'week' ? 'numeric' : undefined,
          year: 'numeric',
        })}
        {view === 'week'
          ? ` – ${new Date(end.getTime() - 1).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
          : ''}
      </p>
      <div className={view === 'week' ? 'week-chart' : 'month-grid'}>
        {days.map((date) => {
          const key = dayKey(date),
            count = summary.counts[key] || 0;
          return (
            <button
              key={key}
              aria-label={`${key}: ${count} popped`}
              aria-pressed={selected === key}
              className={`${selected === key ? 'selected' : ''} ${date.getMonth() !== start.getMonth() && view === 'month' ? 'outside' : ''}`}
              onClick={() => setSelected(key)}
            >
              {view === 'week' ? (
                <>
                  <span className="week-pips">
                    {Array.from({ length: Math.min(10, count) }, (_, i) => (
                      <i key={i} />
                    ))}
                  </span>
                  <strong>{count}</strong>
                  <small>
                    {date.toLocaleDateString(undefined, { weekday: 'narrow' })} {date.getDate()}
                  </small>
                </>
              ) : (
                <>
                  <span>{date.getDate()}</span>
                  {count > 0 && <small>{count}</small>}
                </>
              )}
            </button>
          );
        })}
      </div>
      <p className="hint archive-summary">
        {summary.completed} popped this {view}.{' '}
        {best ? `Best day ${best[0]} with ${best[1]}. ` : ''}
        {minutes(summary.focusMs)} in automatic focus.
      </p>
      <div className="archive-days">
        <span className="eyebrow">{selected} · click to bubble again</span>
        {events.length ? (
          events.map((event) => (
            <div className="archive-row" key={event.id}>
              <button
                disabled={busy === event.id}
                onClick={async () => {
                  setBusy(event.id);
                  await s.run(() => window.todopop.act(event.taskId, 'restore'));
                  setBusy(null);
                }}
              >
                <span>{event.title}</span>
                <small>
                  {URGENCY_LABEL[event.urgency]}
                  {event.durationMs ? ` · ${minutes(event.durationMs)}` : ''}
                </small>
              </button>
              <Button
                variant="text"
                disabled={busy === event.id}
                aria-label={`Restore ${event.title}`}
                onClick={async () => {
                  setBusy(event.id);
                  await s.run(() => window.todopop.act(event.taskId, 'restore'));
                  setBusy(null);
                }}
              >
                + Again
              </Button>
            </div>
          ))
        ) : (
          <p className="empty">No bubbles popped on this day yet.</p>
        )}
      </div>
    </div>
  );
}
