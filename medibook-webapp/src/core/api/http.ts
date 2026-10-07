import axios, { isAxiosError } from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { z } from 'zod';

import { isBackgroundTraffic } from '@/core/api/activity';
import { announceRotation, announceSessionEnd } from '@/core/api/sessionSync';
import { activeSurface } from '@/core/api/surface';
import type { ApiSurface } from '@/core/api/surface';
import type { TokenGrant } from '@/core/api/tokens';
import {
  clearTokens,
  expireSession,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from '@/core/api/tokens';
import { toTokenGrant, tokensResponseSchema } from '@/core/api/tokens.response';
import {
  ACTIVITY_BACKGROUND,
  ACTIVITY_HEADER,
  API_PREFIX,
  API_TIMEOUT_MS,
  AUTH_HEADER,
  AUTH_SCHEME,
  LOGOUT_PATH,
  TOKEN_REFRESH_PATH,
} from '@/core/config/api';
import { API_BASE_URL } from '@/core/config/env';

/**
 * The HTTP clients. One Axios instance per surface, each with:
 *
 * - a request interceptor that attaches `Authorization: Bearer <access>` for
 *   its surface, minting a fresh access token from the refresh token first
 *   when the tab has none (after a reload, or once it expired);
 * - a response interceptor that, on a 401 for an expired/invalid access
 *   token, refreshes once and retries the request once (without
 *   interceptors). Concurrent 401s share one refresh call. When the server refuses the refresh the session is
 *   expired (`onSessionExpired` listeners fire) and the 401 propagates.
 *
 * Refreshes are serialised across this browser's tabs, and every rotation
 * and sign-out is shared with the other tabs (`sessionSync.ts`). A read sent
 * while the user is idle in every tab carries `X-Medibook-Activity:
 * background` (`activity.ts`).
 *
 * Clients resolve to raw Axios responses; `*.api.ts` files validate bodies
 * with Zod and repositories wrap calls in `attempt()` to get a `Result`.
 */

const API_ROOT = `${API_BASE_URL}${API_PREFIX}`;

const HTTP_UNAUTHORIZED = 401;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR_MIN = 500;

const MS_PER_SECOND = 1000;

/** A rate-limited refresh is retried once after `Retry-After`, waiting no longer than this. */
const MAX_RETRY_AFTER_MS = 10_000;
const DEFAULT_RETRY_AFTER_MS = 2_000;

/**
 * After announcing a rotation, keep the cross-tab lock this long, so the other
 * tabs take the new pair before any of them can start a refresh of its own.
 */
const ROTATION_SETTLE_MS = 200;

/** 401 codes a token refresh can fix (backend `core/errors.py`). */
const REFRESHABLE_CODES: ReadonlySet<string> = new Set([
  'AUTH_TOKEN_EXPIRED',
  'AUTH_TOKEN_INVALID',
]);

/** 401 code meaning the whole session family is gone — no refresh can help. */
const SESSION_REVOKED_CODE = 'AUTH_SESSION_REVOKED';

const errorCodeSchema = z.object({ code: z.string() });

/* ------------------------------------------------------------------ refresh */

/** Bare client for the refresh call itself — no interceptors, so no loops. */
const refreshClient = axios.create({ baseURL: API_ROOT, timeout: API_TIMEOUT_MS });

const refreshInFlight = new Map<ApiSurface, Promise<string | null>>();

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function statusOf(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined;
}

function retryAfterMs(error: unknown): number {
  const header: unknown = isAxiosError(error) ? error.response?.headers['retry-after'] : undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0
    ? Math.min(seconds * MS_PER_SECOND, MAX_RETRY_AFTER_MS)
    : DEFAULT_RETRY_AFTER_MS;
}

/** End `surface`'s session in this tab and every other one. */
function endSession(surface: ApiSurface): void {
  expireSession(surface);
  announceSessionEnd(surface);
}

/**
 * Run `task` holding `surface`'s refresh lock across this browser's tabs
 * (Web Locks), so two tabs never send the same refresh token. Without the
 * API the in-tab sharing below still applies.
 */
function withRefreshLock<T>(surface: ApiSurface, task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  return locks ? locks.request(`medibook.refresh.${surface}`, task) : task();
}

async function postRefresh(surface: ApiSurface, refresh: string): Promise<TokenGrant> {
  const response = await refreshClient.post(`/${surface}${TOKEN_REFRESH_PATH}`, { refresh });
  return toTokenGrant(tokensResponseSchema.parse(response.data));
}

/**
 * A refresh that did not go through. The server refusing the refresh token
 * (expired, revoked, rotated out) ends the session everywhere. A network,
 * rate-limit or server failure keeps the tokens, so the next request can try
 * again, and surfaces as that failure.
 */
function refreshFailed(surface: ApiSurface, error: unknown): null {
  const status = statusOf(error);
  if (status !== undefined && status < HTTP_SERVER_ERROR_MIN && status !== HTTP_TOO_MANY_REQUESTS) {
    endSession(surface);
    return null;
  }
  throw error;
}

async function runRefresh(surface: ApiSurface, startedWith: string | null): Promise<string | null> {
  const refresh = getRefreshToken(surface);
  if (!refresh) return null;
  // Another tab refreshed while this one waited for the lock and handed this
  // tab the new pair: use it rather than refresh again.
  if (refresh !== startedWith) {
    const access = getAccessToken(surface);
    if (access) return access;
  }

  let grant: TokenGrant;
  try {
    grant = await postRefresh(surface, refresh);
  } catch (error) {
    if (statusOf(error) !== HTTP_TOO_MANY_REQUESTS) return refreshFailed(surface, error);
    // A whole hospital can share one address, and sign-in and refresh share a
    // per-address limit (SEC-07): wait as the server asks, then try once more.
    await wait(retryAfterMs(error));
    try {
      grant = await postRefresh(surface, refresh);
    } catch (retryError) {
      return refreshFailed(surface, retryError);
    }
  }
  setTokens(surface, grant);
  announceRotation(surface, refresh, grant);
  await wait(ROTATION_SETTLE_MS);
  return grant.access;
}

/**
 * Rotate `surface`'s refresh token into a new pair and return the new access
 * token, or `null` when the tab has no session or the server refused it.
 * Concurrent callers share one in-flight call, and tabs take turns — a
 * rotated-out refresh token sent twice would revoke the whole session family
 * (D-12).
 */
export function refreshAccessToken(surface: ApiSurface): Promise<string | null> {
  const existing = refreshInFlight.get(surface);
  if (existing) return existing;
  const startedWith = getRefreshToken(surface);
  const pending = withRefreshLock(surface, () => runRefresh(surface, startedWith)).finally(() => {
    refreshInFlight.delete(surface);
  });
  refreshInFlight.set(surface, pending);
  return pending;
}

/** The credentials a tab held when it signed out. */
export interface SignedOutSession {
  readonly access: string | null;
  readonly refresh: string | null;
}

/**
 * Sign this tab and every other one out of `surface` at once (SEC-10,
 * SEC-14): the tokens are gone before any request is made, so "Log out"
 * works with the network down. Returns what the tab held, for
 * `revokeSession`.
 */
export function takeSession(surface: ApiSurface): SignedOutSession {
  const session = { access: getAccessToken(surface), refresh: getRefreshToken(surface) };
  clearTokens(surface);
  announceSessionEnd(surface);
  return session;
}

/**
 * Revoke a signed-out session on the server, using the credentials taken
 * before it was cleared. The backend revokes the session that makes the call,
 * so an expired access token is first exchanged for a fresh one.
 */
export async function revokeSession(surface: ApiSurface, session: SignedOutSession): Promise<void> {
  const access =
    session.access ??
    (session.refresh ? (await postRefresh(surface, session.refresh)).access : null);
  if (!access) return;
  await refreshClient.post(`/${surface}${LOGOUT_PATH}`, null, {
    headers: { [AUTH_HEADER]: bearer(access) },
  });
}

/* ------------------------------------------------------------------ clients */

/** Which surface's token each in-flight request carried (for its 401 retry). */
const requestSurface = new WeakMap<InternalAxiosRequestConfig, ApiSurface>();

function bearer(token: string): string {
  return `${AUTH_SCHEME} ${token}`;
}

/** GET (Axios's default method) — the only verb a background poll uses. */
function isReadRequest(config: InternalAxiosRequestConfig): boolean {
  return (config.method ?? 'get').toLowerCase() === 'get';
}

function createClient(basePath: string, resolveSurface: () => ApiSurface): AxiosInstance {
  const client = axios.create({ baseURL: `${API_ROOT}${basePath}`, timeout: API_TIMEOUT_MS });

  client.interceptors.request.use(async (config) => {
    const surface = resolveSurface();
    requestSurface.set(config, surface);
    const token =
      getAccessToken(surface) ??
      (getRefreshToken(surface) ? await refreshAccessToken(surface) : null);
    if (token) config.headers.set(AUTH_HEADER, bearer(token));
    // A read made while the user is idle in every tab is a poll: tell the
    // server so it does not keep the idle session alive (BE-21). Writes are
    // always user actions.
    if (isReadRequest(config) && isBackgroundTraffic(surface)) {
      config.headers.set(ACTIVITY_HEADER, ACTIVITY_BACKGROUND);
    }
    return config;
  });

  client.interceptors.response.use(undefined, async (error: unknown) => {
    if (!isAxiosError(error) || error.response?.status !== HTTP_UNAUTHORIZED) throw error;
    const config = error.config;
    if (!config || !config.headers.has(AUTH_HEADER)) throw error;

    const surface = requestSurface.get(config) ?? resolveSurface();
    const parsed = errorCodeSchema.safeParse(error.response.data);
    const code = parsed.success ? parsed.data.code : null;
    if (code === SESSION_REVOKED_CODE) {
      endSession(surface);
      throw error;
    }
    if (code !== null && !REFRESHABLE_CODES.has(code)) throw error;

    const token = await refreshAccessToken(surface);
    if (!token) {
      endSession(surface);
      throw error;
    }
    // Retry once through the bare Axios instance: it runs none of these
    // interceptors, so a second 401 propagates instead of refreshing again.
    config.headers.set(AUTH_HEADER, bearer(token));
    return axios.request(config);
  });

  return client;
}

/** `/api/v1/hospital/…` with the hospital token. */
export const hospitalApi = createClient('/hospital', () => 'hospital');

/** `/api/v1/platform/…` with the platform (ops) token. */
export const platformApi = createClient('/platform', () => 'platform');

/**
 * `/api/v1/shared/…` (files) with the token of the surface the user is on —
 * the backend accepts either principal and scopes the result by it.
 */
export const sharedApi = createClient('/shared', activeSurface);

/** `/api/v1/shared/…` with no credentials — public endpoints read before login. */
export const publicApi = axios.create({ baseURL: `${API_ROOT}/shared`, timeout: API_TIMEOUT_MS });

const publicSurfaceClients: Readonly<Record<ApiSurface, AxiosInstance>> = {
  hospital: axios.create({ baseURL: `${API_ROOT}/hospital`, timeout: API_TIMEOUT_MS }),
  platform: axios.create({ baseURL: `${API_ROOT}/platform`, timeout: API_TIMEOUT_MS }),
};

/**
 * `/api/v1/<surface>/…` with no credentials and no refresh — for the
 * pre-auth endpoints (login, password forgot/reset, invitations), which must
 * never send or rotate a stale token from an earlier session.
 */
export function publicApiFor(surface: ApiSurface): AxiosInstance {
  return publicSurfaceClients[surface];
}

/** The authenticated client for `surface`. */
export function apiFor(surface: ApiSurface): AxiosInstance {
  return surface === 'hospital' ? hospitalApi : platformApi;
}
