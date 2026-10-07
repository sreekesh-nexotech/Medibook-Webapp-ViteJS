/**
 * Transport constants shared by every API call. Values that mirror the
 * backend cite where the backend defines them, so a change there has one
 * place to land here.
 */

/** Every REST path is mounted under this prefix (backend `core/cors.py` `API_PREFIX`). */
export const API_PREFIX = '/api/v1';

/** Give up on a request after this long; the backend's own worker timeout is 30 s. */
export const API_TIMEOUT_MS = 30_000;

/** Header carrying the access token (bearer scheme — the API never uses cookies). */
export const AUTH_HEADER = 'Authorization';

/** Prefix of the `Authorization` header value. */
export const AUTH_SCHEME = 'Bearer';

/** Optimistic-concurrency header for PATCH/PUT/DELETE on versioned rows (`core/api.py`). */
export const IF_MATCH_HEADER = 'If-Match';

/** Replay-safe writes: the backend dedupes a declared method by this key (D-21). */
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

/**
 * Marks a request the user did not make (a poll while they are idle), so the
 * server does not count it as activity for the idle session limit (BE-21,
 * SEC-01-B). The backend's CORS allowlist must accept this header.
 */
export const ACTIVITY_HEADER = 'X-Medibook-Activity';

/** `ACTIVITY_HEADER` value for background traffic. */
export const ACTIVITY_BACKGROUND = 'background';

/** Echoed in every error envelope's `request_id`; the backend also reads it. */
export const REQUEST_ID_HEADER = 'X-Request-Id';

/** Path (relative to a surface) that rotates a refresh token into a new pair (D-12). */
export const TOKEN_REFRESH_PATH = '/auth/token/refresh';

/** Path (relative to a surface) that revokes the calling session. */
export const LOGOUT_PATH = '/auth/logout';

/* ---------------------------------------------------------------- query cache */

/** Default freshness of server data before a background refetch. */
export const QUERY_STALE_TIME_MS = 30_000;

/** Retries for a failed query that might succeed on retry (network / 5xx only). */
export const QUERY_MAX_RETRIES = 2;

/** Public app config barely changes; the backend itself caches it for 60 s. */
export const APP_CONFIG_STALE_TIME_MS = 5 * 60_000;

/* ----------------------------------------------------------------- websocket */

/** WebSocket paths are mounted at the origin root, not under `API_PREFIX` (`routing.py`). */
export const WS_PREFIX = '/ws';

/** The token rides as the second subprotocol: `['bearer', <jwt>]` (`core/ws.py`). */
export const WS_BEARER_SUBPROTOCOL = 'bearer';

/** Client heartbeat; the server closes an idle socket after 5 minutes. */
export const WS_PING_INTERVAL_MS = 30_000;

/** First reconnect delay; doubles per failed attempt up to the cap below. */
export const WS_RECONNECT_BASE_MS = 1_000;

/** Longest wait between reconnect attempts. */
export const WS_RECONNECT_MAX_MS = 30_000;

/**
 * Server close codes (`core/ws.py`): bad/missing/expired token, permission
 * refused (BE-21: the role may not open this channel), idle timeout.
 */
export const WS_CLOSE_UNAUTHORIZED = 4401;
export const WS_CLOSE_FORBIDDEN = 4403;
export const WS_CLOSE_IDLE = 4408;

/** Normal closure — what `socket.close()` sends when the app closes it on purpose. */
export const WS_CLOSE_NORMAL = 1000;
