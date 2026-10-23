import { useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { BrandLogo, Button, FieldLabel, StatusDot, TextInput } from '@todopop/ui';
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
        const data = await chrome.storage.local.get(['token', 'status']);
        if (!alive || current !== revision) return;
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
      if (area === 'local' && (changes.token || changes.status)) void refresh();
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
          <p className="tagline">Pop it before it fills your screen.</p>
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
            <h2>
              {connected
                ? 'A little room to focus.'
                : connection === 'connecting'
                  ? 'Finding your desktop…'
                  : connection === 'disconnected'
                    ? 'Your bubbles are waiting.'
                    : 'Bring your bubbles along.'}
            </h2>
            <p className="description">
              {connected
                ? 'Your work pages are linked to TODOPOP. Bubbles tuck away when you’re on task and return when you leave.'
                : connection === 'connecting'
                  ? 'Keep TODOPOP open on your Mac. We’ll connect this browser to your desktop.'
                  : connection === 'disconnected'
                    ? 'Open TODOPOP on your Mac. This browser will reconnect automatically.'
                    : 'Pair Chrome with TODOPOP on your Mac, so your bubbles know when to give you space.'}
            </p>
            {connected && (
              <div className="connected-note">
                <StatusDot state="connected" />
                <span>Ready for automatic focus</span>
              </div>
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
                  Copy it from Chrome connection in the desktop panel.
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
                  {busy ? 'Connecting…' : 'Connect to TODOPOP'}
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
                    Change pairing code
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
            <ol id="pairing-help" className="help-steps">
              <li>
                <span>1</span>
                <p>Open TODOPOP on your Mac.</p>
              </li>
              <li>
                <span>2</span>
                <p>
                  Click <strong>Connect</strong> at the bottom of the panel.
                </p>
              </li>
              <li>
                <span>3</span>
                <p>Copy the pairing code and paste it here.</p>
              </li>
            </ol>
          )}
        </section>
        <footer className="privacy">
          <span className="privacy-ring" aria-hidden="true" />
          <p>
            Just between Chrome and your Mac.
            <br />
            <span>Page context stays on this computer.</span>
          </p>
        </footer>
      </div>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<Popup />);
