import { mkdir, readFile, writeFile, rename, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { validateTaskInput, type Task } from '@todopop/shared';
export class TaskRepository {
  tasks: Task[] = [];
  warning: string | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(readonly directory: string) {}
  async load() {
    await mkdir(this.directory, { recursive: true });
    try {
      const data: unknown = JSON.parse(await readFile(join(this.directory, 'tasks.json'), 'utf8'));
      if (!Array.isArray(data) || data.length > 1000) throw new Error('Invalid task file');
      const ids = new Set<string>();
      this.tasks = data.map((t) => {
        if (!t || typeof t.id !== 'string' || ids.has(t.id) || typeof t.completed !== 'boolean')
          throw new Error('Invalid task');
        ids.add(t.id);
        return {
          ...validateTaskInput(t),
          id: t.id,
          completed: t.completed,
          createdAt: typeof t.createdAt === 'number' ? t.createdAt : Date.now(),
          completedAt: typeof t.completedAt === 'number' ? t.completedAt : undefined,
          snoozedUntil: typeof t.snoozedUntil === 'number' ? t.snoozedUntil : undefined,
          position:
            t.position && Number.isFinite(t.position.x) && Number.isFinite(t.position.y)
              ? { x: t.position.x, y: t.position.y }
              : undefined,
        };
      });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        const backup = `tasks-recovery-${Date.now()}.json`;
        await copyFile(join(this.directory, 'tasks.json'), join(this.directory, backup));
        this.warning = `Your saved task file could not be read. A copy was kept as ${backup}.`;
      }
    }
  }
  mutate(transform: (tasks: Task[]) => Task[]) {
    const run = this.queue.then(async () => {
      const next = transform(this.tasks);
      const path = join(this.directory, 'tasks.json');
      await writeFile(path + '.tmp', JSON.stringify(next, null, 2), { mode: 0o600 });
      await rename(path + '.tmp', path);
      this.tasks = next;
    });
    this.queue = run.catch(() => {});
    return run;
  }
  async token() {
    const path = join(this.directory, 'pairing-token');
    try {
      const token = (await readFile(path, 'utf8')).trim();
      if (/^[a-f0-9]{64}$/.test(token)) return token;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    const token = randomBytes(32).toString('hex');
    await writeFile(path, token, { mode: 0o600 });
    return token;
  }
}
