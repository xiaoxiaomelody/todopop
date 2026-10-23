import { useEffect, useRef, useState } from 'react';
import { BrandLogo, Button, StatusDot } from '@todopop/ui';
import { TaskForm } from '../components/TaskForm';
import { TaskList } from '../components/TaskList';
import { GrowthControls } from '../components/GrowthControls';
import { Appearance } from '../components/Appearance';
import { Archive } from '../components/Archive';
import { Tutorial } from '../components/Tutorial';
import { useTaskStore } from '../store/taskStore';
export function Landing() {
  const s = useTaskStore(),
    panel = useRef<HTMLDivElement>(null),
    offered = useRef(false);
  const [section, setSection] = useState<string | null>(null),
    [tour, setTour] = useState(false),
    [pairing, setPairing] = useState<{ token: string; port: number } | null>(null),
    [copied, setCopied] = useState(false);
  const floating = s.tasks.filter((t) => !t.completed && !t.deletedAt);
  const toggle = (id: string) => setSection((current) => (current === id ? null : id));
  useEffect(() => {
    if (!s.loading && !offered.current) {
      offered.current = true;
      if (!s.settings.tutorialDone) setTour(true);
    }
  }, [s.loading, s.settings.tutorialDone]);
  useEffect(() => {
    const open = () => {
      setTour(false);
      setSection('appearance');
    };
    window.addEventListener('manage-groups', open);
    return () => window.removeEventListener('manage-groups', open);
  }, []);
  useEffect(() => {
    if (!panel.current) return;
    const o = new ResizeObserver(() =>
      window.todopop.resize(panel.current!.getBoundingClientRect().height + 8),
    );
    o.observe(panel.current);
    return () => o.disconnect();
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSection(null);
        if (s.selectedGroupId) void s.run(() => window.todopop.selectGroup(null));
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [s.selectedGroupId]);
  const done = () => {
    setTour(false);
    void s.run(() => window.todopop.setSettings({ tutorialDone: true }));
  };
  return (
    <div className="control-shell" ref={panel}>
      <div className="control-panel">
        <header className="control-bar">
          <BrandLogo
            actions={[
              {
                name: 'Blow a bubble',
                symbol: '+',
                active: section === 'new',
                onClick: () => toggle('new'),
              },
              {
                name: 'Popped bubbles',
                symbol: '◌',
                active: section === 'popped',
                onClick: () => toggle('popped'),
              },
              {
                name: 'Tint and groups',
                symbol: '◐',
                active: section === 'appearance',
                onClick: () => toggle('appearance'),
              },
            ]}
          />
          <div className="control-utilities">
            <button aria-label="Open tutorial" title="Quick tour" onClick={() => setTour(!tour)}>
              ?
            </button>
            <button
              aria-label="Chrome connection"
              title="Chrome connection · demo"
              onClick={async () => {
                toggle('connection');
                if (!pairing) await s.run(async () => setPairing(await window.todopop.pairing()));
              }}
            >
              <StatusDot state={s.connected ? 'connected' : 'idle'} />
            </button>
          </div>
        </header>
        {tour && <Tutorial onDone={done} />}
        <div className="control-content">
          {section === 'new' && (
            <section aria-label="Create a bubble">
              <h2>Blow a bubble</h2>
              <TaskForm onDone={() => setSection(null)} />
              <details className="floating-details">
                <summary>Floating · {floating.length}</summary>
                <GrowthControls />
                <TaskList
                  tasks={floating}
                  onEdit={(id) => void s.run(() => window.todopop.edit(id))}
                />
              </details>
            </section>
          )}
          {section === 'popped' && (
            <section aria-label="Popped receipt">
              <h2>Popped</h2>
              <Archive />
            </section>
          )}
          {section === 'appearance' && (
            <section aria-label="Tint and group settings">
              <h2>Tint & Group</h2>
              <Appearance />
            </section>
          )}
          {section === 'connection' && (
            <section aria-label="Chrome demo connection">
              <h2>Connect Chrome</h2>
              <p className="hint">Demo only · copy this code into the extension.</p>
              {pairing && (
                <>
                  <input
                    className="pairing-code"
                    readOnly
                    aria-label="Pairing code"
                    value={pairing.token}
                  />
                  <Button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(pairing.token);
                        setCopied(true);
                      } catch {
                        useTaskStore.setState({ problem: 'Select the code and copy it manually.' });
                      }
                    }}
                  >
                    {copied ? 'Copied' : 'Copy code'}
                  </Button>
                </>
              )}
              <p className="hint">{s.connected ? 'Connected' : 'Waiting for Chrome'}</p>
            </section>
          )}
        </div>
        {(s.problem || s.error) && (
          <p className="error" role="alert">
            {s.problem || s.error}
          </p>
        )}
        {s.loading && <p className="empty">Loading…</p>}
        {s.selectedGroupId && (
          <button
            className="clear-selection"
            onClick={() => void s.run(() => window.todopop.selectGroup(null))}
          >
            Clear group selection · Esc
          </button>
        )}
      </div>
      {s.toast && (
        <div className="toast" role="status">
          <span>{s.toast.message}</span>
          {s.toast.undoId && (
            <button onClick={() => void s.run(() => window.todopop.undo(s.toast!.undoId!))}>
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
