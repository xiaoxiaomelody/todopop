import { mkdir, readFile, writeFile, rename, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { hydrate, initialState, type AppState, type Task } from '@todopop/shared';
export class TaskRepository {
  state: AppState = initialState();
  warning: string | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(readonly directory: string) {}
  get tasks() {
    return this.state.tasks;
  }
  async load() {
    await mkdir(this.directory, { recursive: true });
    let source = join(this.directory, 'state.json');
    try {
      let data: string;
      try {
        data = await readFile(source, 'utf8');
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
        source = join(this.directory, 'tasks.json');
        data = await readFile(source, 'utf8');
      }
      this.state = hydrate(JSON.parse(data));
      if (source.endsWith('tasks.json')) {
        await copyFile(source, join(this.directory, `tasks-before-v2-${Date.now()}.json`));
        await this.mutateState((s) => s);
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        if (e instanceof Error && e.message.startsWith('Unsupported data version')) throw e;
        const backup = `data-recovery-${Date.now()}.json`;
        await copyFile(source, join(this.directory, backup));
        this.warning = `Saved data could not be read. A copy was kept as ${backup}.`;
      }
    }
  }
  mutateState(transform: (state: AppState) => AppState) {
    const run = this.queue.then(async () => {
      const next = transform(this.state);
      const file = join(this.directory, 'state.json');
      await writeFile(file + '.tmp', JSON.stringify(next, null, 2), { mode: 0o600 });
      await rename(file + '.tmp', file);
      this.state = next;
    });
    this.queue = run.catch(() => {});
    return run;
  }
  mutate(transform: (tasks: Task[]) => Task[]) {
    return this.mutateState((state) => ({ ...state, tasks: transform(state.tasks) }));
  }
  async token() {
    const file = join(this.directory, 'pairing-token');
    try {
      const token = (await readFile(file, 'utf8')).trim();
      if (/^[a-f0-9]{64}$/.test(token)) return token;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
    const token = randomBytes(32).toString('hex');
    await writeFile(file, token, { mode: 0o600 });
    return token;
  }
  flush() {
    return this.queue;
  }
}
