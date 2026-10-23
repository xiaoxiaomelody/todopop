import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBrowserContext, validateTaskInput } from '../validation.ts';
import { getFocusState } from '../focusEngine.ts';
import { urlsMatch } from '../urlMatcher.ts';
import type { Task } from '../types.ts';

test('trims task inputs and allows URL-free reminders', () => {
  assert.deepEqual(validateTaskInput({ title: ' Read notes ', url: ' ', urgency: 1 }), {
    title: 'Read notes',
    url: undefined,
    urgency: 1,
    group: 'None',
  });
});
test('rejects unsafe URLs, credentials, invalid names, and urgency', () => {
  for (const input of [
    { title: ' ', urgency: 1 },
    { title: 'x', urgency: 0 },
    { title: 'x', urgency: 5 },
    { title: 'x', urgency: 2, url: 'javascript:alert(1)' },
    { title: 'x', urgency: 2, url: 'https://user:secret@example.com' },
    { title: 'x', urgency: 2, group: 'unknown' },
    { title: 'x'.repeat(121), urgency: 2 },
  ])
    assert.throws(() => validateTaskInput(input));
});
test('validates browser messages before they reach focus decisions', () => {
  assert.ok(
    isBrowserContext({
      type: 'CONTEXT_CHANGED',
      browser: 'chrome',
      isFocused: true,
      url: 'https://example.com',
    }),
  );
  assert.ok(
    isBrowserContext({ type: 'CONTEXT_CHANGED', browser: 'chrome', isFocused: false, url: null }),
  );
  for (const value of [
    null,
    {},
    [],
    { type: 'CONTEXT_CHANGED', browser: 'chrome', isFocused: 'true', url: null },
    { type: 'CONTEXT_CHANGED', browser: 'chrome', isFocused: true, url: 'file:///private/file' },
    { type: 'CONTEXT_CHANGED', browser: 'chrome', isFocused: true, url: 'https://a:b@example.com' },
  ])
    assert.equal(isBrowserContext(value), false);
});
test('completing one shared-URL task keeps focus until all matching tasks complete', () => {
  const base: Task = {
    id: '1',
    title: 'Draft',
    urgency: 3,
    completed: false,
    url: 'https://example.com/work',
  };
  assert.equal(
    getFocusState(base.url!, true, [
      { ...base, completed: true },
      { ...base, id: '2' },
    ]),
    'FOCUS',
  );
  assert.equal(getFocusState(base.url!, true, [{ ...base, completed: true }]), 'NORMAL');
});
test('does not conflate Google document kinds, IDs, or nested paths', () => {
  assert.equal(
    urlsMatch(
      'https://docs.google.com/document/d/abc/edit',
      'https://docs.google.com/spreadsheets/d/abc/edit',
    ),
    false,
  );
  assert.equal(
    urlsMatch(
      'https://docs.google.com/document/d/abc/edit/other',
      'https://docs.google.com/document/d/abc/edit',
    ),
    false,
  );
  assert.equal(urlsMatch('http://example.com/work', 'https://example.com/work'), false);
});
