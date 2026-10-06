import { z } from 'zod';

import { refreshAccessToken } from '@/core/api/http';
import type { ApiSurface } from '@/core/api/surface';
import { getAccessToken, onSessionExpired } from '@/core/api/tokens';
import {
  WS_BEARER_SUBPROTOCOL,
  WS_CLOSE_NORMAL,
  WS_CLOSE_UNAUTHORIZED,
  WS_PING_INTERVAL_MS,
  WS_PREFIX,
  WS_RECONNECT_BASE_MS,
  WS_RECONNECT_MAX_MS,
} from '@/core/config/api';
import { WS_BASE_URL } from '@/core/config/env';

/**
 * Push-only WebSocket client for the backend's channels (`core/ws.py`,
 * `routing.py`): `ws/hospital/queue`, `ws/hospital/alerts`, …
 *
 * - The access token rides as a subprotocol (`['bearer', <jwt>]`), never in
 *   the URL.
 * - The client pings every 30 s (the server drops sockets idle for 5 min).
 * - Frames are `{type, data, ts}`, validated before they reach a listener;
 *   `pong` frames and anything malformed are dropped.
 * - On an unexpected close it reconnects with exponential backoff. A 4401
 *   (bad token) refreshes the token first; if that fails, it stops.
 * - Two pings with nothing back mean the line is dead even without a close
 *   event: the socket is dropped and reopened (RUN-07).
 * - The server refuses a bad token before accepting, which the browser only
 *   reports as an abnormal close. Three refusals in a row while online
 *   refresh the token once; if they continue, the status is `unauthorized`
 *   ("Live updates off") instead of reconnecting forever.
 * - The socket closes when its session ends, and retries at once when the
 *   browser comes back online.
 * - Every real operation stays REST — the only frame sent is `ping`.
 */

export const socketFrameSchema = z.object({
  type: z.string(),
  data: z.unknown(),
  ts: z.string(),
});

/** One server push. `data` is validated by the feature that owns the channel. */
export type SocketFrame = z.infer<typeof socketFrameSchema>;

export type SocketStatus = 'connecting' | 'open' | 'reconnecting' | 'closed' | 'unauthorized';

export interface SocketOptions {
  /** Channel path below `/ws`, e.g. `/hospital/queue`. */
  readonly path: string;
  /** Whose token authorises the socket. */
  readonly surface: ApiSurface;
  readonly onFrame: (frame: SocketFrame) => void;
  readonly onStatus?: (status: SocketStatus) => void;
}

export interface SocketHandle {
  /** Close for good — no reconnect. */
  readonly close: () => void;
}

const PING_FRAME = JSON.stringify({ type: 'ping' });
const PONG_TYPE = 'pong';
/** Pings in a row that got nothing back before the line counts as dead. */
const MAX_MISSED_PONGS = 2;
/** Handshakes in a row refused before opening, while online, before the token is suspected. */
const MAX_FAILED_OPENS = 3;
/** Close code for a socket the client gives up on as dead (4000–4999 is the application range). */
const WS_CLOSE_STALE = 4000;

function socketUrl(path: string): string {
  const origin =
    WS_BASE_URL ||
    `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
  return `${origin}${WS_PREFIX}${path}`;
}

function parseFrame(raw: unknown): SocketFrame | null {
  if (typeof raw !== 'string') return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    // Not JSON — the server never sends that; ignore the frame.
    return null;
  }
  const parsed = socketFrameSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

/** Open a managed socket. Call the returned `close()` when the consumer unmounts. */
export function openSocket({ path, surface, onFrame, onStatus }: SocketOptions): SocketHandle {
  let socket: WebSocket | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let isClosedByUser = false;
  let hasRetriedAuth = false;
  let missedPongs = 0;
  let failedOpens = 0;

  const stopPing = () => {
    if (pingTimer !== null) clearInterval(pingTimer);
    pingTimer = null;
  };

  const scheduleReconnect = () => {
    const delay = Math.min(WS_RECONNECT_BASE_MS * 2 ** attempt, WS_RECONNECT_MAX_MS);
    attempt += 1;
    onStatus?.('reconnecting');
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void connect();
    }, delay);
  };

  /** Drop a socket without waiting for its close event, which a dead line may never send. */
  const abandon = (ws: WebSocket) => {
    ws.onopen = null;
    ws.onmessage = null;
    ws.onclose = null;
    ws.close(WS_CLOSE_STALE);
  };

  /** Back online: retry now instead of waiting out the backoff. */
  const onOnline = () => {
    if (retryTimer === null || isClosedByUser) return;
    clearTimeout(retryTimer);
    retryTimer = null;
    attempt = 0;
    void connect();
  };
  window.addEventListener('online', onOnline);

  const handleUnauthorized = async () => {
    if (hasRetriedAuth) {
      onStatus?.('unauthorized');
      return;
    }
    hasRetriedAuth = true;
    const token = await refreshAccessToken(surface).catch(() => null);
    if (isClosedByUser) return;
    if (token) {
      void connect();
    } else {
      onStatus?.('unauthorized');
    }
  };

  async function connect(): Promise<void> {
    if (isClosedByUser) return;
    const token = getAccessToken(surface) ?? (await refreshAccessToken(surface).catch(() => null));
    if (isClosedByUser) return;
    if (!token) {
      onStatus?.('unauthorized');
      return;
    }

    onStatus?.('connecting');
    const ws = new WebSocket(socketUrl(path), [WS_BEARER_SUBPROTOCOL, token]);
    socket = ws;
    let opened = false;

    ws.onopen = () => {
      opened = true;
      attempt = 0;
      failedOpens = 0;
      missedPongs = 0;
      hasRetriedAuth = false;
      onStatus?.('open');
      pingTimer = setInterval(() => {
        if (missedPongs >= MAX_MISSED_PONGS) {
          stopPing();
          abandon(ws);
          socket = null;
          scheduleReconnect();
          return;
        }
        missedPongs += 1;
        ws.send(PING_FRAME);
      }, WS_PING_INTERVAL_MS);
    };

    ws.onmessage = (event: MessageEvent<unknown>) => {
      const frame = parseFrame(event.data);
      if (!frame) return;
      // Any frame proves the line is alive, not only a pong.
      missedPongs = 0;
      if (frame.type !== PONG_TYPE) onFrame(frame);
    };

    ws.onclose = (event: CloseEvent) => {
      stopPing();
      socket = null;
      if (isClosedByUser) {
        onStatus?.('closed');
        return;
      }
      if (event.code === WS_CLOSE_UNAUTHORIZED) {
        void handleUnauthorized();
        return;
      }
      if (!opened && navigator.onLine) {
        failedOpens += 1;
        if (failedOpens >= MAX_FAILED_OPENS) {
          failedOpens = 0;
          void handleUnauthorized();
          return;
        }
      }
      scheduleReconnect();
    };
  }

  const close = () => {
    if (isClosedByUser) return;
    isClosedByUser = true;
    stopPing();
    if (retryTimer !== null) clearTimeout(retryTimer);
    window.removeEventListener('online', onOnline);
    stopListening();
    socket?.close(WS_CLOSE_NORMAL);
    onStatus?.('closed');
  };

  // Signed out or revoked, here or in another tab: no socket outlives its session.
  const stopListening = onSessionExpired((ended) => {
    if (ended === surface) close();
  });

  void connect();

  return { close };
}
