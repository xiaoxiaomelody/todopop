import { WebSocketServer, WebSocket } from 'ws';
import { timingSafeEqual } from 'node:crypto';
import { isBrowserContext, type BrowserContext } from '@todopop/shared';
export const BRIDGE_PORT = 17846;
export function startBrowserBridge(
  token: string,
  onContext: (context: BrowserContext | null, connected: boolean) => void,
  onError: (message: string) => void,
  port = BRIDGE_PORT,
) {
  let active: WebSocket | null = null;
  let lastContext = 0;
  const server = new WebSocketServer({
    host: '127.0.0.1',
    port,
    maxPayload: 8192,
    verifyClient: (info: { origin: string }) =>
      /^chrome-extension:\/\/[a-p]{32}$/.test(info.origin),
  });
  server.on('error', (error) =>
    onError(
      `Chrome connection unavailable: ${error.message}. Close another TODOPOP instance and restart.`,
    ),
  );
  const staleTimer = setInterval(() => {
    if (active && Date.now() - lastContext > 25000) {
      active.close(4000, 'Context expired');
      active = null;
      onContext(null, false);
    }
  }, 5000);
  server.on('connection', (socket) => {
    let authenticated = false;
    const authTimer = setTimeout(() => socket.close(4001, 'Pairing required'), 5000);
    socket.on('error', () => {});
    socket.on('message', (raw) => {
      try {
        const value = JSON.parse(raw.toString());
        if (!authenticated) {
          if (
            value.type !== 'AUTH' ||
            typeof value.token !== 'string' ||
            value.token.length !== token.length ||
            !timingSafeEqual(Buffer.from(value.token), Buffer.from(token))
          ) {
            socket.close(4001, 'Invalid pairing code');
            return;
          }
          authenticated = true;
          clearTimeout(authTimer);
          const previous = active;
          active = socket;
          previous?.close(4002, 'Replaced');
          lastContext = Date.now();
          onContext(null, true);
          socket.send(JSON.stringify({ type: 'AUTH_OK' }));
          return;
        }
        if (socket !== active || !isBrowserContext(value)) {
          socket.close(4003, 'Invalid context');
          return;
        }
        lastContext = Date.now();
        onContext(value, true);
      } catch {
        socket.close(4003, 'Invalid message');
      }
    });
    socket.on('close', () => {
      clearTimeout(authTimer);
      if (active === socket) {
        active = null;
        onContext(null, false);
      }
    });
  });
  return {
    server,
    close() {
      clearInterval(staleTimer);
      for (const socket of server.clients) socket.terminate();
      server.close();
    },
  };
}
