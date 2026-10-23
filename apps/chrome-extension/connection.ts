import type { BrowserContext } from '@todopop/shared';
let socket: WebSocket | null = null;
let heartbeat: ReturnType<typeof setInterval> | undefined;
let retry: ReturnType<typeof setTimeout> | undefined;
let authenticated = false;
let generation = 0;
let reportContext: () => Promise<void>;
export function sendContext(context: BrowserContext) {
  if (authenticated && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(context));
}
async function status(value: string) {
  await chrome.storage.local.set({ status: value });
}
export async function connect(contextProvider: () => Promise<void>) {
  reportContext = contextProvider;
  if (
    socket &&
    (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)
  )
    return;
  clearTimeout(retry);
  const attempt = ++generation;
  const { token } = await chrome.storage.local.get('token');
  if (attempt !== generation) return;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    await status('Pair with the desktop app');
    return;
  }
  const current = new WebSocket('ws://127.0.0.1:17846');
  socket = current;
  await status('Connecting…');
  current.onopen = () => {
    current.send(JSON.stringify({ type: 'AUTH', token }));
  };
  current.onmessage = (event) => {
    try {
      if (JSON.parse(event.data).type === 'AUTH_OK') {
        authenticated = true;
        void status('Connected');
        void reportContext();
        heartbeat = setInterval(() => {
          void reportContext();
        }, 10000);
      }
    } catch {
      current.close();
    }
  };
  current.onerror = () => {
    current.close();
  };
  current.onclose = (event) => {
    if (socket !== current) return;
    socket = null;
    authenticated = false;
    clearInterval(heartbeat);
    void status(event.code === 4001 ? 'Pairing code rejected' : 'Desktop app disconnected');
    if (event.code !== 4001)
      retry = setTimeout(() => {
        void connect(reportContext);
      }, 3000);
  };
}
export function reconnect(provider: () => Promise<void>) {
  generation++;
  clearTimeout(retry);
  clearInterval(heartbeat);
  authenticated = false;
  const old = socket;
  socket = null;
  old?.close();
  void connect(provider);
}
