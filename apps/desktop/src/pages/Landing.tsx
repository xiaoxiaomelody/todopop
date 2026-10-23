import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { TaskForm } from '../components/TaskForm';
import { TaskList } from '../components/TaskList';
import { useTaskStore } from '../store/taskStore';
import { BrandLogo, Button, StatusDot } from '@todopop/ui';
import closeIcon from '../assets/42a21.svg';
function Section({
  title,
  meta,
  open,
  toggle,
  children,
}: {
  title: string;
  meta?: string;
  open: boolean;
  toggle(): void;
  children: ReactNode;
}) {
  return (
    <section className="accordion">
      <button className="accordion-head" aria-expanded={open} onClick={toggle}>
        <span>{title}</span>
        <small>{meta}</small>
        <span className="chevron">{open ? '−' : '+'}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="accordion-body"
          >
            <div className="section-content">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
export function Landing() {
  const state = useTaskStore();
  const panel = useRef<HTMLDivElement>(null);
  const [sections, setSections] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [info, setInfo] = useState(false);
  const [pairing, setPairing] = useState<{ token: string; port: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const floating = state.tasks.filter((t) => !t.completed),
    popped = state.tasks.filter((t) => t.completed);
  const editTask = state.tasks.find((t) => t.id === editing);
  useEffect(() => {
    if (!panel.current || !window.todopop) return;
    const observer = new ResizeObserver(() =>
      window.todopop.resize(panel.current!.getBoundingClientRect().height + 32),
    );
    observer.observe(panel.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => window.todopop?.onEdit((id) => setEditing(id)), []);
  const toggle = (id: string) =>
    setSections((current) =>
      current.includes(id) ? current.filter((s) => s !== id) : [...current, id],
    );
  return (
    <div className="panel-shell" ref={panel}>
      <div className="panel" data-node-id="14:6">
        <header className="brand">
          <div className="grip" />
          <BrandLogo />
          <button
            className="icon-button close-panel"
            aria-label="Hide panel"
            title="Show again from the Dock"
            onClick={() => window.todopop.hide()}
          >
            <img src={closeIcon} width="21" height="21" alt="" />
          </button>
          <div className="tagline">
            Pop it before it fills your screen.{' '}
            <button
              className="info-button"
              aria-label="About TODOPOP"
              onClick={() => setInfo(!info)}
            >
              i
            </button>
          </div>
        </header>
        {info && (
          <div className="info-copy">
            Drag a bubble to move it. Click to open its work page; right-click to edit. Use ✓ to pop
            it. Bubbles disappear when you’re on a matching page in Chrome.
            <p>Close this panel to tuck it away. Click TODOPOP in the Dock to bring it back.</p>
          </div>
        )}
        <Section title="Blow a bubble" open={sections.includes('new')} toggle={() => toggle('new')}>
          <TaskForm
            key={sections.includes('new') ? 'new-open' : 'new-closed'}
            onDone={() =>
              setSections((current) => [...current.filter((s) => s !== 'new'), 'floating'])
            }
          />
        </Section>
        <Section
          title="Floating"
          meta={`${floating.length} FLOATING`}
          open={sections.includes('floating')}
          toggle={() => toggle('floating')}
        >
          <TaskList tasks={floating} onEdit={setEditing} />
        </Section>
        <Section
          title="Popped"
          meta={`${popped.length} POPPED`}
          open={sections.includes('popped')}
          toggle={() => toggle('popped')}
        >
          <TaskList tasks={popped} archived onEdit={setEditing} />
        </Section>
        <div className={`connection-bar ${state.focus === 'FOCUS' ? 'focused' : ''}`}>
          <StatusDot state={state.connected ? 'connected' : 'idle'} />
          <span>
            {state.focus === 'FOCUS'
              ? 'In the bubble'
              : state.connected
                ? 'Chrome connected'
                : 'Chrome not connected'}
          </span>
          <button
            aria-label="Chrome connection"
            onClick={async () => {
              toggle('connection');
              if (!pairing)
                await state.run(async () => {
                  setPairing(await window.todopop.pairing());
                });
            }}
          >
            {sections.includes('connection') ? '−' : 'Connect'}
          </button>
        </div>
        {state.focus === 'FOCUS' && (
          <p className="focus-message">{state.matchedTask} · bubbles tucked away</p>
        )}
        {sections.includes('connection') && (
          <div className="connection-details">
            <h2>Make room for focus.</h2>
            <p>Load the TODOPOP Chrome extension, then paste your pairing code into its popup.</p>
            <ol>
              <li>Chrome → Extensions → Developer mode</li>
              <li>
                Load unpacked → <code>apps/chrome-extension/dist</code>
              </li>
              <li>Click the extension and paste the code below.</li>
            </ol>
            {pairing && (
              <>
                <input readOnly aria-label="Pairing code" value={pairing.token} />
                <Button
                  className="pill"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(pairing.token);
                      setCopied(true);
                    } catch {
                      state.run(async () => {
                        throw new Error('Select the pairing code and copy it manually.');
                      });
                    }
                  }}
                >
                  {copied ? 'Copied ✓' : 'Copy pairing code'}
                </Button>
              </>
            )}
            <p className="hint">
              Active-tab context stays on this computer. Nothing is sent to a cloud service.
            </p>
          </div>
        )}
        {(state.error || state.problem) && (
          <p className="error" role="alert">
            {state.problem || state.error}
          </p>
        )}
        {state.loading && <p className="empty">Loading your bubbles…</p>}
      </div>
      {editTask && (
        <div className="edit-panel" role="dialog" aria-label="Edit bubble">
          <div className="edit-header">
            <h2 className="eyebrow">Edit bubble</h2>
            <button
              className="icon-button"
              aria-label="Close edit"
              onClick={() => setEditing(null)}
            >
              ×
            </button>
          </div>
          <TaskForm key={editTask.id} task={editTask} onDone={() => setEditing(null)} />
        </div>
      )}
    </div>
  );
}
