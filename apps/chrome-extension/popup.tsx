import { useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { BrandLogo, Button, FieldLabel, StatusDot, TextInput, applyTheme } from '@todopop/ui';
import '@todopop/ui/styles.css';
import './popup.css';

type Connection = 'unpaired' | 'connecting' | 'connected' | 'rejected' | 'disconnected';
function Popup() {
  const [connection, setConnection] = useState<Connection>('unpaired');
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [changeCode, setChangeCode] = useState(false);
  const [help, setHelp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    let revision = 0;
    async function refresh() {
      const current = ++revision;
      try {
        const data = await chrome.storage.local.get(['token', 'status', 'tint']);
        if (!alive || current !== revision) return;
        if (typeof data.tint === 'string') applyTheme(data.tint);
        const paired = typeof data.token === 'string' && /^[a-f0-9]{64}$/.test(data.token);
        setConnection(
          !paired
            ? 'unpaired'
            : data.status === 'Connected'
              ? 'connected'
              : data.status === 'Connecting…'
                ? 'connecting'
                : data.status === 'Pairing code rejected'
                  ? 'rejected'
                  : 'disconnected',
        );
        setLoading(false);
      } catch {
        if (alive) {
          setLoading(false);
          setError('Couldn’t read the connection. Close this popup and try again.');
        }
      }
    }
    const changed = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && (changes.token || changes.status || changes.tint)) void refresh();
    };
    chrome.storage.onChanged.addListener(changed);
    void refresh();
    return () => {
      alive = false;
      chrome.storage.onChanged.removeListener(changed);
    };
  }, []);
  useEffect(() => {
    if (connection === 'connected') {
      setChangeCode(false);
      setCode('');
      setError(null);
    }
  }, [connection]);
  useEffect(() => {
    const root = document.querySelector('.popup-shell');
    if (!root) return;
    const observer = new ResizeObserver(() => {
      void chrome.windows
        .getCurrent()
        .then(async (win) => {
          if (win.type !== 'popup' || win.id === undefined || !win.height) return;
          const height = Math.min(
            600,
            Math.max(
              220,
              Math.ceil(root.getBoundingClientRect().height) + win.height - window.innerHeight,
            ),
          );
          if (Math.abs(win.height - height) > 2) await chrome.windows.update(win.id, { height });
        })
        .catch(() => {});
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);
  const paired = connection !== 'unpaired';
  const connected = connection === 'connected';
  const formVisible = !paired || connection === 'rejected' || changeCode;
  const status = loading
    ? 'Checking…'
    : (
        {
          unpaired: 'Not paired',
          connecting: 'Connecting',
          connected: 'Connected',
          rejected: 'Check pairing code',
          disconnected: 'Disconnected',
        } as const
      )[connection];
  const dot = connected
    ? 'connected'
    : connection === 'connecting'
      ? 'connecting'
      : connection === 'rejected'
        ? 'error'
        : 'idle';
  async function pair(event: FormEvent) {
    event.preventDefault();
    const token = code.replace(/\s+/g, '').toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(token)) {
      setError('Paste the complete pairing code from the desktop panel.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await chrome.storage.local.set({ token, status: 'Connecting…' });
      setCode('');
      setShowCode(false);
    } catch {
      setError('Couldn’t save the pairing code. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      await chrome.storage.local.remove('token');
      setConnection('unpaired');
      setChangeCode(false);
      setCode('');
      setShowCode(false);
    } catch {
      setError('Couldn’t disconnect. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  async function retry() {
    setBusy(true);
    setError(null);
    try {
      await chrome.runtime.sendMessage({ type: 'RECONNECT' });
    } catch {
      setError('Open TODOPOP on your Mac, then try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="popup-shell">
      <div className="popup-panel">
        <header className="brand">
          <div className="brand-top">
            <BrandLogo />
            <span className="chrome-label">Chrome</span>
          </div>
        </header>
        <section className="connection" aria-labelledby="connection-heading">
          <div className="section-head">
            <h1 id="connection-heading">Chrome connection</h1>
            <span className={`connection-status ${dot}`} role="status" aria-live="polite">
              <StatusDot state={dot} />
              {status}
            </span>
          </div>
          <div className="connection-body">
            {connected && <p className="description">Automatic focus is on.</p>}
            {(connection === 'connecting' || connection === 'disconnected') && (
              <p className="description">Keep TODOPOP open on your Mac.</p>
            )}
            {connection === 'rejected' && (
              <p className="inline-error" role="alert">
                That code didn’t match. Copy a fresh code from TODOPOP and try again.
              </p>
            )}
            {formVisible && (
              <form onSubmit={pair} noValidate className="pair-form">
                <label htmlFor="token">
                  <div className="field-heading">
                    <FieldLabel>Pairing code</FieldLabel>
                    <button
                      type="button"
                      className="reveal"
                      aria-pressed={showCode}
                      onClick={() => setShowCode(!showCode)}
                    >
                      {showCode ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <TextInput
                    id="token"
                    name="token"
                    type={showCode ? 'text' : 'password'}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Paste your pairing code"
                    value={code}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'pair-error' : 'code-hint'}
                    onChange={(e) => {
                      setCode(e.target.value);
                      setError(null);
                    }}
                  />
                </label>
                <p className="code-hint" id="code-hint">
                  Desktop panel → Connect → Copy code.
                </p>
                {error && (
                  <p className="inline-error" id="pair-error" role="alert">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  variant="filled"
                  className="full-width"
                  disabled={busy || loading || !code.trim()}
                >
                  {busy ? 'Connecting…' : 'Connect'}
                </Button>
                {paired && changeCode && (
                  <Button type="button" variant="text" onClick={() => setChangeCode(false)}>
                    Cancel
                  </Button>
                )}
              </form>
            )}
            {!formVisible && (
              <div className="connection-actions">
                {connection === 'disconnected' && (
                  <Button
                    type="button"
                    className="full-width"
                    onClick={() => {
                      void retry();
                    }}
                    disabled={busy}
                  >
                    Try again
                  </Button>
                )}
                <div className="paired-actions">
                  <Button
                    type="button"
                    variant="text"
                    onClick={() => setChangeCode(true)}
                    disabled={busy}
                  >
                    Change code
                  </Button>
                  <Button
                    type="button"
                    variant="text"
                    onClick={() => {
                      void disconnect();
                    }}
                    disabled={busy}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            )}
            {!formVisible && error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </section>
        {formVisible && (
          <section className="help-section">
            <button
              className="help-toggle"
              aria-expanded={help}
              aria-controls="pairing-help"
              onClick={() => setHelp(!help)}
            >
              <span>Where’s my code?</span>
              <span className="chevron" aria-hidden="true">
                {help ? '−' : '+'}
              </span>
            </button>
            {help && (
              <p id="pairing-help" className="help-copy">
                Open the desktop panel → Connect → Copy code.
              </p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<Popup />);
