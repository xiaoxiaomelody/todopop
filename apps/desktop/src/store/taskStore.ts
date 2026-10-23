import { create } from 'zustand';
import type { Snapshot } from '@todopop/shared';
type State = Snapshot & {
  loading: boolean;
  problem: string | null;
  apply(s: Snapshot): void;
  run(action: () => Promise<void>): Promise<boolean>;
};
export const useTaskStore = create<State>((set) => ({
  tasks: [],
  focus: 'NORMAL',
  connected: false,
  error: null,
  matchedTask: null,
  loading: true,
  problem: null,
  apply: (s) => set({ ...s, loading: false }),
  run: async (action) => {
    try {
      await action();
      set({ problem: null });
      return true;
    } catch (e) {
      set({
        problem:
          e instanceof Error
            ? e.message.replace(/^Error invoking remote method '[^']+': Error: /, '')
            : 'Something went wrong. Please try again.',
      });
      return false;
    }
  },
}));
export function connectStore() {
  if (!window.todopop) {
    useTaskStore.setState({
      loading: false,
      problem: 'Open TODOPOP with npm run dev to use the desktop app.',
    });
    return () => {};
  }
  let updated = false;
  const unsubscribe = window.todopop.subscribe((s) => {
    updated = true;
    useTaskStore.getState().apply(s);
  });
  void window.todopop
    .snapshot()
    .then((s) => {
      if (!updated) useTaskStore.getState().apply(s);
    })
    .catch((e) => useTaskStore.setState({ loading: false, problem: String(e) }));
  return unsubscribe;
}
