import { useEffect, useState } from 'react';
import { Button, StatusDot } from '@todopop/ui';
import { useTaskStore } from '../store/taskStore';
export function ChromeConnection() {
  const connected = useTaskStore((s) => s.connected);
  const run = useTaskStore((s) => s.run);
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let active = true;
    void run(async () => {
      const pairing = await window.todopop.pairing();
      if (active) setCode(pairing.token);
    });
    return () => {
      active = false;
    };
  }, [run]);
  return (
    <section className="chrome-connection" aria-label="Chrome connection settings">
      <div className="connection-heading">
        <h2>Chrome connection</h2>
        <div className="connection-status" data-connected={connected} role="status">
          <StatusDot state={connected ? 'connected' : 'idle'} />
          <span>{connected ? 'Connected' : 'Not connected'}</span>
        </div>
      </div>
      <p className="connection-instruction">Paste this code into the extension.</p>
      <label className="connection-code-label">
        <span className="eyebrow">Pairing code</span>
        <textarea
          className="pairing-code"
          aria-label="Pairing code"
          readOnly
          rows={2}
          value={code}
          placeholder="Loading code…"
          spellCheck={false}
        />
      </label>
      <Button
        className="connection-copy"
        disabled={!code}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
          } catch {
            useTaskStore.setState({ problem: 'Select the code and copy it manually.' });
          }
        }}
      >
        {copied ? 'Copied' : 'Copy pairing code'}
      </Button>
      <div className="connection-extension">
        <a
          href="#chrome-extension"
          aria-disabled="true"
          title="Chrome extension link coming soon"
          onClick={(e) => e.preventDefault()}
        >
          Go to Chrome extension ↗
        </a>
        <span>Coming soon</span>
      </div>
    </section>
  );
}
