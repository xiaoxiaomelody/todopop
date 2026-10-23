import { test } from 'node:test';
import assert from 'node:assert/strict';
import { urlsMatch } from '../urlMatcher.ts';
import { getFocusState } from '../focusEngine.ts';
import type { Task } from '../types.ts';
const task: Task = { id: '1', title: 'Write', url: 'https://example.com/work', urgency: 2, completed: false };
test('normalizes fragments and trailing slashes', () => assert.ok(urlsMatch('https://example.com/work/#notes', task.url!)));
test('does not match unrelated paths, origins or queries', () => {
  for (const url of ['https://example.com/workshop', 'https://other.com/work', 'https://example.com/work?id=2']) assert.equal(urlsMatch(url, task.url!), false);
});
test('matches Google Docs IDs across editor routes', () => {
 assert.ok(urlsMatch('https://docs.google.com/document/d/abc/edit?usp=sharing', 'https://docs.google.com/document/d/abc/view'));
 assert.equal(urlsMatch('https://docs.google.com/document/d/xyz/edit', 'https://docs.google.com/document/d/abc/edit'), false);
});
test('invalid URLs never match', () => { for (const url of ['oops', 'javascript:alert(1)', 'file:///tmp/test']) assert.equal(urlsMatch(url, url), false); });
test('focus requires active Chrome and an incomplete matching task', () => {
 assert.equal(getFocusState(task.url!, true, [task]), 'FOCUS');
 assert.equal(getFocusState(task.url!, false, [task]), 'NORMAL');
 assert.equal(getFocusState(null, true, [task]), 'NORMAL');
 assert.equal(getFocusState(task.url!, true, [{...task, completed:true}]), 'NORMAL');
 assert.equal(getFocusState('https://example.com/elsewhere', true, [task]), 'NORMAL');
});
