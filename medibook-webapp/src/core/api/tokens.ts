import type { ApiSurface } from '@/core/api/surface';
import { STORAGE_KEY_REFRESH_TOKEN } from '@/core/storage/storage.keys';
import { readSession, removeSession, writeSession } from '@/core/storage/sessionStore';

/**
 * Token storage, one pair per surface (Prompt A-AUTH, bearer scheme):
 *
 * - the **access** token lives in memory only — gone on reload, never in
 *   storage, never logged;
 * - the **refresh** token lives in `sessionStorage` — it survives a reload of
 *   this tab (the HTTP client mints a fresh access token from it on the first
 *   request) but not a closed tab, and is never shared across tabs.
 *
 * Login (F1) calls `setTokens`; the HTTP client rotates them on refresh;
 * logout calls `clearTokens`.
 */

export interface TokenGrant {
  readonly access: string;
  readonly refresh: string;
  /** Seconds until the access token expires, as the backend reports it. */
  readonly accessExpiresIn: number;
}

interface AccessToken {
  readonly token: string;
  /** Epoch ms after which the token is treated as expired. */
  readonly expiresAt: number;
}

const MS_PER_SECOND = 1000;

/** Treat an access token as expired this long before it really is (clock skew). */
const ACCESS_EXPIRY_SKEW_MS = 10_000;

const accessTokens = new Map<ApiSurface, AccessToken>();

/** Store a fresh pair from login or refresh. */
export function setTokens(surface: ApiSurface, grant: TokenGrant): void {
  accessTokens.set(surface, {
    token: grant.access,
    expiresAt: Date.now() + grant.accessExpiresIn * MS_PER_SECOND - ACCESS_EXPIRY_SKEW_MS,
  });
  writeSession(STORAGE_KEY_REFRESH_TOKEN[surface], grant.refresh);
}

/** The current access token, or `null` when there is none or it has expired. */
export function getAccessToken(surface: ApiSurface): string | null {
  const current = accessTokens.get(surface);
  if (!current || current.expiresAt <= Date.now()) return null;
  return current.token;
}

export function getRefreshToken(surface: ApiSurface): string | null {
  return readSession(STORAGE_KEY_REFRESH_TOKEN[surface]);
}

/** True when this tab holds a session for `surface` (it may still need a refresh). */
export function hasSession(surface: ApiSurface): boolean {
  return getAccessToken(surface) !== null || getRefreshToken(surface) !== null;
}

/** Forget both tokens for `surface` (logout, or a refresh the server refused). */
export function clearTokens(surface: ApiSurface): void {
  accessTokens.delete(surface);
  removeSession(STORAGE_KEY_REFRESH_TOKEN[surface]);
}

/* ------------------------------------------------------------ expiry events */

type SessionExpiredListener = (surface: ApiSurface) => void;

const expiredListeners = new Set<SessionExpiredListener>();

/**
 * Subscribe to "this surface's session is over" — fired after the server
 * refuses a refresh (revoked, rotated-out or expired refresh token) and the
 * tokens have been cleared. The auth layer (F1) listens to clear the query
 * cache and redirect to login. Returns the unsubscribe function.
 */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  expiredListeners.add(listener);
  return () => {
    expiredListeners.delete(listener);
  };
}

/** Clear `surface`'s tokens and notify listeners. Called by the HTTP client only. */
export function expireSession(surface: ApiSurface): void {
  clearTokens(surface);
  for (const listener of expiredListeners) listener(surface);
}
