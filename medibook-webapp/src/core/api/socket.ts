import { z } from 'zod';

import { refreshAccessToken } from '@/core/api/http';
import type { ApiSurface } from '@/core/api/surface';
import { getAccessToken } from '@/core/api/tokens';
import {
  WS_BEARER_SUBPROTOCOL,
  WS_CLOSE_FORBIDDEN,
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
 * - On an unexpected close it reconnects with exponential backoff.
 * - The server refuses a socket by *accepting* it and then closing it, so an
 *   `open` event proves nothing (UAT-43, SEC-07-B). The connection only counts
 *   as established once the first real frame (a push or a `pong`) arrives;
 *   only then are the backoff and the auth-retry guard reset.
 * - 4401 (bad or expired token): refresh the token once, then reconnect after
 *   the backoff delay. A second 4401 before any frame arrived stops with
 *   `unauthorized` — a refused socket must never loop refresh + reconnect,
 *   which would spend the per-address sign-in budget the whole hospital shares.
 * - 4403 (the role may not open this channel): stop with `forbidden`; no
 *   refresh or retry can change the answer.
 * - Every real operation stays REST — the only frame sent is `ping`.
 */

export const socketFrameSchema = z.object({
  type: z.string(),
  data: z.unknown(),
  ts: z.string(),
});

/** One server push. `data` is validated by the feature that owns the channel. */
export type SocketFrame = z.infer<typeof socketFrameSchema>;

/**
 * - `connecting`: handshake in progress; `open`: the server has sent a frame.
 * - `reconnecting`: waiting out the backoff before the next attempt.
 * - `closed`: closed by the caller. `unauthorized`: the token was refused
 *   twice in a row (sign-in needed). `forbidden`: the role may not use this
 *   channel (4403). The last three are final.
 */
export type SocketStatus =
  'connecting' | 'open' | 'reconnecting' | 'closed' | 'unauthorized' | 'forbidden';

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
  let isStopped = false;
  /** Set when a 4401 triggered a refresh; cleared only by a real frame. */
  let hasRetriedAuth = false;

  const stopPing = () => {
    if (pingTimer !== null) clearInterval(pingTimer);
    pingTimer = null;
  };

  /** Give up for good with a final status (no reconnect). */
  const stop = (status: 'unauthorized' | 'forbidden') => {
    isStopped = true;
    onStatus?.(status);
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

  const handleUnauthorized = async () => {
    if (hasRetriedAuth) {
      stop('unauthorized');
      return;
    }
    hasRetriedAuth = true;
    const token = await refreshAccessToken(surface).catch(() => null);
    if (isClosedByUser) return;
    if (token) scheduleReconnect();
    else stop('unauthorized');
  };

  async function connect(): Promise<void> {
    if (isClosedByUser || isStopped) return;
    const token = getAccessToken(surface) ?? (await refreshAccessToken(surface).catch(() => null));
    if (isClosedByUser) return;
    if (!token) {
      stop('unauthorized');
      return;
    }

    onStatus?.('connecting');
    const ws = new WebSocket(socketUrl(path), [WS_BEARER_SUBPROTOCOL, token]);
    socket = ws;
    let hasFrame = false;

    ws.onopen = () => {
      // Not "connected" yet: a refused socket is accepted, then closed.
      pingTimer = setInterval(() => ws.send(PING_FRAME), WS_PING_INTERVAL_MS);
      // Ask for a pong at once, so a healthy socket proves itself without
      // waiting a whole ping interval for the first frame.
      ws.send(PING_FRAME);
    };

    ws.onmessage = (event: MessageEvent<unknown>) => {
      const frame = parseFrame(event.data);
      if (!frame) return;
      if (!hasFrame) {
        hasFrame = true;
        attempt = 0;
        hasRetriedAuth = false;
        onStatus?.('open');
      }
      if (frame.type !== PONG_TYPE) onFrame(frame);
    };

    ws.onclose = (event: CloseEvent) => {
      stopPing();
      socket = null;
      if (isClosedByUser) {
        onStatus?.('closed');
        return;
      }
      if (event.code === WS_CLOSE_FORBIDDEN) {
        stop('forbidden');
        return;
      }
      if (event.code === WS_CLOSE_UNAUTHORIZED) {
        void handleUnauthorized();
        return;
      }
      scheduleReconnect();
    };
  }

  void connect();

  return {
    close: () => {
      isClosedByUser = true;
      stopPing();
      if (retryTimer !== null) clearTimeout(retryTimer);
      socket?.close(WS_CLOSE_NORMAL);
      onStatus?.('closed');
    },
  };
}
