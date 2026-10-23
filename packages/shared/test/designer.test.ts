import type { Task } from '../types.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { designerInk, slotColor, vividColor } from '../designerColor.ts';
import { createMembrane, membraneStep, smoothMembrane } from '../membrane.ts';
import { layoutBubbles } from '../layoutEngine.ts';
import {
  initialState,
  addTask,
  changeGroup,
  applySettings,
  groupColor,
  hydrate,
} from '../domain.ts';
test('designer tint and group colors stay valid, with independent custom wheel colors', () => {
  for (let h = 0; h < 360; h += 15)
    for (const s of [0, 0.5, 1]) {
      assert.match(designerInk(h, s), /^#[0-9a-f]{6}$/);
      assert.match(vividColor(h, s), /^#[0-9a-f]{6}$/);
    }
  const g = { kind: 'wheel' as const, h: 180, saturation: 0.7 };
  assert.equal(groupColor(g, '#1a419e'), groupColor(g, '#9c1c31'));
  assert.notEqual(slotColor(0, '#1a419e'), slotColor(0, '#9c1c31'));
  const settings = applySettings(initialState().settings, { tintWheel: { h: 178, s: 0.9 } });
  assert.equal(settings.tint, designerInk(178, 0.9));
  assert.deepEqual(hydrate({ ...initialState(), settings }).settings.tintWheel, { h: 178, s: 0.9 });
});
test('edge queues wrap into additional lanes and preserve group/global side precedence', () => {
  const area = { x: 0, y: 0, width: 1000, height: 600 },
    tasks = Array.from({ length: 8 }, (_, i) => ({
      id: String(i),
      title: 't',
      urgency: 4 as const,
      completed: false,
      size: 298,
      groupId: i % 2 ? 'Work' : 'School',
    }));
  const side = (t: Task) => (t.groupId === 'School' ? ('left' as const) : ('right' as const));
  const normal = layoutBubbles(tasks, area, [], new Map(), side);
  for (const item of normal.items)
    assert.equal(item.side, side(tasks.find((t) => t.id === item.id)!));
  assert.ok(new Set(normal.items.filter((t) => t.side === 'left').map((t) => t.x)).size > 1);
  const all = layoutBubbles(tasks, area, [], new Map(), () => 'left');
  assert.ok(all.items.every((t) => t.side === 'left'));
  const restored = layoutBubbles(tasks, area, [], new Map(), side);
  assert.ok(
    restored.items
      .filter((t) => tasks[Number(t.id)].groupId === 'Work')
      .every((t) => t.side === 'right'),
  );
});
test('ported membrane responds to pressure and remains finite with smooth curves', () => {
  const a = {
      id: 'a',
      title: 'a',
      urgency: 4 as const,
      completed: false,
      size: 446,
      position: { x: 0, y: 0 },
    },
    b = { ...a, id: 'b', position: { x: 230, y: 0 } },
    m = createMembrane();
  let result = membraneStep(m, a, [a, b], [], 1 / 60);
  for (let i = 0; i < 180; i++) result = membraneStep(m, a, [a, b], [], 1 / 60);
  assert.equal(result.points.length, 40);
  assert.ok(result.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
  const curve = smoothMembrane(result.points);
  assert.equal(curve.flat.length, 80);
  assert.match(curve.path, /^M.*Q.*Z$/);
  assert.ok(result.points[0].x < 223 + 446 * 0.305);
});

test('crowded growing layouts keep centers local and edge identities stable', () => {
  const area = { x: 0, y: 0, width: 1100, height: 700 };
  const obstacles = [{ x: 360, y: 24, width: 340, height: 440 }];
  for (const side of ['any', 'left', 'right'] as const) {
    let tasks: Task[] = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      title: 'growing',
      urgency: 4,
      completed: false,
      size: 560 + i * 63,
    }));
    let previous = new Map(
      layoutBubbles(tasks, area, obstacles, new Map(), () => side).items.map((p) => [p.id, p]),
    );
    for (let frame = 0; frame < 180; frame++) {
      tasks = tasks.map((t) => ({ ...t, size: t.size! + 1 }));
      const next = layoutBubbles(tasks, area, obstacles, previous, () => side).items;
      for (const p of next) {
        const old = previous.get(p.id)!;
        const delta = Math.hypot(
          p.x + p.size / 2 - old.x - old.size / 2,
          p.y + p.size / 2 - old.y - old.size / 2,
        );
        assert.ok(delta <= 2.5, `${side} ${p.id} jumped ${delta}px`);
      }
      previous = new Map(next.map((p) => [p.id, p]));
    }
  }
});
