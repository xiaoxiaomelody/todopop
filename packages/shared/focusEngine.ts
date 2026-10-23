import type { FocusState, Task } from './types.ts';
import { urlsMatch } from './urlMatcher.ts';
export function getFocusState(
  activeUrl: string | null,
  chromeFocused: boolean,
  tasks: readonly Task[],
): FocusState {
  if (!chromeFocused || !activeUrl) return 'NORMAL';
  return tasks.some(
    (task) => !task.completed && !task.deletedAt && task.url && urlsMatch(activeUrl, task.url),
  )
    ? 'FOCUS'
    : 'NORMAL';
}
