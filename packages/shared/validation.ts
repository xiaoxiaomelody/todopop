import type { BrowserContext, TaskInput } from './types.ts';
export function validateTaskInput(value: unknown): TaskInput {
  if (!value || typeof value !== 'object') throw new Error('Invalid task.');
  const v = value as Record<string, unknown>;
  if (typeof v.title !== 'string' || !v.title.trim() || v.title.trim().length > 120)
    throw new Error('Use a task name between 1 and 120 characters.');
  if (![1, 2, 3, 4].includes(v.urgency as number)) throw new Error('Choose an urgency level.');
  if (v.group !== undefined && !['None', 'School', 'Work', 'Life'].includes(v.group as string))
    throw new Error('Invalid group.');
  if (v.url !== undefined && typeof v.url !== 'string') throw new Error('Invalid URL.');
  const url = (v.url as string | undefined)?.trim();
  if (url) {
    try {
      const u = new URL(url);
      if (
        !['http:', 'https:'].includes(u.protocol) ||
        u.username ||
        u.password ||
        url.length > 4096
      )
        throw 0;
    } catch {
      throw new Error('Enter a full http:// or https:// URL.');
    }
  }
  if (
    v.groupId !== undefined &&
    v.groupId !== null &&
    (typeof v.groupId !== 'string' || v.groupId.length > 100)
  )
    throw new Error('Invalid group');
  return {
    ...(v.groupId !== undefined ? { groupId: v.groupId as string | null } : {}),
    title: v.title.trim(),
    url: url || undefined,
    urgency: v.urgency as TaskInput['urgency'],
    group: (v.group || 'None') as TaskInput['group'],
  };
}
export function isBrowserContext(value: unknown): value is BrowserContext {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.type !== 'CONTEXT_CHANGED' || v.browser !== 'chrome' || typeof v.isFocused !== 'boolean')
    return false;
  if (v.url === null) return true;
  if (typeof v.url !== 'string' || v.url.length > 4096) return false;
  try {
    const u = new URL(v.url);
    return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password;
  } catch {
    return false;
  }
}
