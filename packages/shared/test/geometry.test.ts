import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  unionCoverage,
  visibleCoverage,
  bubbleOutline,
  COVERAGE_LIMIT,
  clippedBubbleFrame,
} from '../bubbleGeometry.ts';
import { initialState, addTask, taskAction, undoCompletion, groupColor } from '../domain.ts';
import { hexToHsv, hsvToHex } from '../color.ts';
const area = { x: 0, y: 0, width: 100, height: 100 };
const rect = (x: number, y: number, w: number, h: number) => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];
test('coverage counts union once, clips offscreen and honors nonzero display origins', () => {
  assert.equal(unionCoverage([rect(0, 0, 60, 100), rect(40, 0, 60, 100)], area), 1);
  assert.equal(unionCoverage([rect(-50, -50, 100, 100)], area), 0.25);
  assert.equal(
    unionCoverage([rect(-200, 50, 100, 100)], { x: -200, y: 50, width: 100, height: 100 }),
    1,
  );
  assert.equal(unionCoverage([rect(0, 0, 95, 100)], area), COVERAGE_LIMIT);
  assert.equal(unionCoverage([rect(0, 0, 94, 100)], area) < COVERAGE_LIMIT, true);
});
test('deformation is localized at contacts, and coverage uses those same points', () => {
  const a = {
    id: 'a',
    title: 'a',
    urgency: 4 as const,
    completed: false,
    size: 446,
    position: { x: 0, y: 0 },
  };
  const b = { ...a, id: 'b', position: { x: 230, y: 0 } };
  const alone = bubbleOutline(a, []),
    pressed = bubbleOutline(a, [b]);
  assert.ok(pressed[0].x < alone[0].x - 10);
  assert.ok(Math.abs(pressed[32].x - alone[32].x) < 1);
  const expected = unionCoverage(
    [pressed, bubbleOutline(b, [a]).map((p) => ({ x: p.x + 230, y: p.y }))],
    { x: 0, y: 0, width: 800, height: 500 },
  );
  assert.equal(visibleCoverage([a, b], { x: 0, y: 0, width: 800, height: 500 }), expected);
});
test('undo completion retains the same round, URL and waiting time without duplicate history', () => {
  let s = addTask(
    initialState(),
    { title: 'Notes', url: 'https://example.com', urgency: 4 },
    'a',
    1,
  );
  s.tasks[0].growthMs = 4000;
  s = taskAction(s, 'a', 'complete', 100, 'e');
  s = undoCompletion(s, 'a');
  assert.equal(s.tasks[0].completed, false);
  assert.equal(s.tasks[0].growthMs, 4000);
  assert.equal(s.tasks[0].url, 'https://example.com');
  assert.equal(s.history.length, 0);
});
test('HSV editing round-trips original presets including neutral colors', () => {
  for (const hex of ['#1a419e', '#078b86', '#76e2c8', '#808080', '#000000', '#ffffff']) {
    const c = hexToHsv(hex);
    assert.equal(hsvToHex(c.h, c.s, c.v), hex);
  }
});

test('large bubble frames clip to the work area without changing logical contour coordinates', () => {
  assert.deepEqual(
    clippedBubbleFrame(2000, { x: -300, y: -400 }, { x: 0, y: 25, width: 1440, height: 800 }),
    { x: 0, y: 25, width: 1440, height: 800 },
  );
  assert.equal(
    unionCoverage([rect(0, 0, 100, 100)], area, 1, [
      { x: 0, y: 0, width: 20, height: 100 },
      { x: 10, y: 0, width: 20, height: 100 },
    ]),
    0.7,
  );
});

test('every tinted preset stays valid hex for the picker and SVG', () => {
  for (const tint of ['#1a249e', '#9c1c31', '#078b86', '#292929', '#ffffff'])
    for (let slot = 0; slot < 6; slot++) {
      const hex = groupColor({ kind: 'palette', slot }, tint);
      assert.match(hex, /^#[0-9a-f]{6}$/i);
      const c = hexToHsv(hex);
      assert.ok(Number.isFinite(c.h) && Number.isFinite(c.s) && Number.isFinite(c.v));
      assert.equal(hsvToHex(c.h, c.s, c.v), hex);
    }
});
