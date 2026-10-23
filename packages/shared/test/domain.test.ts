import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initialState,
  hydrate,
  addTask,
  editTask,
  taskAction,
  rebubble,
  undoDelete,
  changeGroup,
  pauseSettings,
  isPaused,
  reorder,
  applySettings,
  groupColor,
} from '../domain.ts';
import { bubbleSize, grow } from '../growthEngine.ts';
import { layoutBubbles } from '../layoutEngine.ts';
import { historySummary } from '../history.ts';
const now = Date.parse('2026-10-23T04:00:00Z');
const input = { title: 'Graph notes', urgency: 4 as const, groupId: 'School' };
function populated() {
  return addTask(initialState(), input, 'task-1', now);
}
test('legacy tasks migrate without changing identity and completed history is created once', () => {
  const old = [
    {
      id: 'old',
      title: 'Read',
      urgency: 2,
      completed: true,
      completedAt: now - 1000,
      group: 'School',
      position: { x: -2, y: 200 },
    },
  ];
  const migrated = hydrate(old, now);
  assert.equal(migrated.tasks[0].groupId, 'School');
  assert.equal(migrated.history.length, 1);
  assert.equal(migrated.tasks[0].position!.x, -2);
  const again = hydrate(JSON.parse(JSON.stringify(migrated)), now + 1000);
  assert.equal(again.history.length, 1);
  assert.equal(again.tasks[0].id, 'old');
});
test('versioned state round-trips groups, settings, growth, sessions and deleted tasks', () => {
  let s = populated();
  s = changeGroup(s, 'create', { name: 'Jobs', side: 'right' }, 'jobs');
  s = editTask(s, 'task-1', { ...input, groupId: 'jobs' });
  s.settings = applySettings(s.settings, { tint: '#9c1c31', pauseIndefinite: true });
  s.tasks[0].growthMs = 17000;
  s = taskAction(s, 'task-1', 'delete', now + 2000, 'delete-1');
  assert.deepEqual(
    JSON.parse(JSON.stringify(hydrate(JSON.parse(JSON.stringify(s))))),
    JSON.parse(JSON.stringify(s)),
  );
  assert.throws(() => hydrate({ ...s, schemaVersion: 3 }));
});
test('rebubble starts a new round and preserves historical completion', () => {
  let s = populated();
  s.tasks[0].growthMs = 50000;
  s.tasks[0].focusMs = 120000;
  s = taskAction(s, 'task-1', 'complete', now + 3000, 'complete-1');
  const next = rebubble(s, 'task-1', 'task-2', now + 4000);
  assert.equal(next.tasks.length, 2);
  assert.equal(next.tasks[0].completed, true);
  assert.equal(next.tasks[1].sourceTaskId, 'task-1');
  assert.equal(next.tasks[1].growthMs, 0);
  assert.equal(next.tasks[1].focusMs, 0);
  assert.equal(next.history[0].durationMs, 120000);
  assert.equal(next.history.length, 1);
});
test('complete is idempotent and delete undo retains the same task and history', () => {
  let s = populated();
  s = taskAction(s, 'task-1', 'complete', now + 1000, 'c1');
  s = taskAction(s, 'task-1', 'complete', now + 2000, 'c2');
  assert.equal(s.history.length, 1);
  s = taskAction(s, 'task-1', 'delete', now + 3000, 'd1');
  const restored = undoDelete(s, 'task-1');
  assert.equal(restored.tasks[0].deletedAt, undefined);
  assert.equal(restored.tasks[0].completed, true);
  assert.equal(restored.history.length, 1);
});
test('global pause supports exact durations, tomorrow and indefinite resume', () => {
  const base = initialState().settings;
  assert.equal(pauseSettings(base, '30m', now).pauseUntil, now + 1800000);
  assert.equal(pauseSettings(base, '1h', now).pauseUntil, now + 3600000);
  const midnight = pauseSettings(base, 'tomorrow', now).pauseUntil!;
  assert.ok(midnight > now);
  assert.equal(new Date(midnight).getHours(), 0);
  assert.equal(isPaused(pauseSettings(base, 'manual', now), now + 99999999), true);
  assert.equal(isPaused(pauseSettings(base, 'resume', now), now), false);
  assert.equal(isPaused(pauseSettings(base, '30m', now), now + 1800000), false);
});
test('growth is exact at the formal rate, slower per urgency, and ignores paused or hidden tasks', () => {
  const t = populated().tasks[0];
  assert.equal(bubbleSize(t, 120000) - bubbleSize(t, 0), Math.round(37.8 / 0.61));
  assert.equal(bubbleSize({ ...t, urgency: 1 }, 99999999), 118);
  const paused = grow([t], 1000, now, true);
  assert.equal(paused[0].growthMs, 0);
  assert.equal(grow([{ ...t, snoozedUntil: now + 1000 }], 1000, now, false)[0].growthMs, 0);
  assert.equal(grow([t], 1000, now, false)[0].growthMs, 1000);
  assert.equal(grow([t], 90000000, now, false)[0].growthMs, 5000);
});
test('palette colors swap, custom colors survive tint, and deleting a group unassigns tasks', () => {
  let s = populated();
  const before = s.groups[0].color;
  s = changeGroup(s, 'update', { id: 'School', color: { kind: 'palette', slot: 5 } }, 'unused');
  assert.deepEqual(s.groups.find((g) => g.id === 'Work')!.color, before);
  s = changeGroup(
    s,
    'update',
    { id: 'School', color: { kind: 'custom', hex: '#123456' } },
    'unused',
  );
  assert.equal(groupColor(s.groups[0].color, '#9c1c31'), '#123456');
  s = changeGroup(s, 'delete', { id: 'School' }, 'unused');
  assert.equal(s.tasks[0].groupId, null);
  assert.equal(s.tasks[0].title, 'Graph notes');
});
test('reorder validates the entire active list and persists rank', () => {
  let s = addTask(populated(), { title: 'Second', urgency: 1 }, 'task-2', now);
  s = reorder(s, ['task-2', 'task-1']);
  assert.equal(s.tasks[1].rank, 0);
  assert.throws(() => reorder(s, ['task-1', 'task-1']));
  assert.throws(() => reorder(s, ['task-1']));
});
test('layout preserves reachable visible bodies and avoids a center panel', () => {
  const tasks = Array.from({ length: 4 }, (_, i) => ({
    ...populated().tasks[0],
    id: String(i),
    size: 192,
    position: undefined,
  }));
  const area = { x: 0, y: 0, width: 1440, height: 900 };
  const panel = { x: 530, y: 300, width: 376, height: 300 };
  const result = layoutBubbles(tasks, area, [panel], new Map(), () => 'any');
  assert.equal(result.items.length, 4);
  for (const item of result.items) {
    const cx = item.x + item.size / 2,
      cy = item.y + item.size / 2,
      r = item.size * 0.305;
    assert.ok(cx - r >= 0 && cx + r <= 1441);
    assert.ok(cy - r >= 0 && cy + r <= 901);
    const x = Math.max(panel.x, Math.min(cx, panel.x + panel.width)),
      y = Math.max(panel.y, Math.min(cy, panel.y + panel.height));
    assert.ok(Math.hypot(cx - x, cy - y) >= r - 2);
  }
});
test('history counts completions once and apportions focus across the period boundary', () => {
  const summary = historySummary(
    [
      { id: 'c', taskId: 'x', title: 'x', urgency: 1, kind: 'completed', at: now + 1000 },
      {
        id: 'f',
        taskId: 'x',
        title: 'x',
        urgency: 1,
        kind: 'focus',
        at: now + 3000,
        durationMs: 5000,
      },
    ],
    now,
    now + 2000,
  );
  assert.equal(summary.completed, 1);
  assert.equal(summary.focusMs, 2000);
});
