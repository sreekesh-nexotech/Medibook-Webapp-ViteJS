import axios, { isAxiosError } from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { z } from 'zod';

import { activeSurface } from '@/core/api/surface';
import type { ApiSurface } from '@/core/api/surface';
import { expireSession, getAccessToken, getRefreshToken, setTokens } from '@/core/api/tokens';
import { toTokenGrant, tokensResponseSchema } from '@/core/api/tokens.response';
import {
  API_PREFIX,
  API_TIMEOUT_MS,
  AUTH_HEADER,
  AUTH_SCHEME,
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
 * Clients resolve to raw Axios responses; `*.api.ts` files validate bodies
 * with Zod and repositories wrap calls in `attempt()` to get a `Result`.
 */

const API_ROOT = `${API_BASE_URL}${API_PREFIX}`;

const HTTP_UNAUTHORIZED = 401;
const HTTP_SERVER_ERROR_MIN = 500;

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

async function runRefresh(surface: ApiSurface): Promise<string | null> {
  const refresh = getRefreshToken(surface);
  if (!refresh) return null;
  try {
    const response = await refreshClient.post(`/${surface}${TOKEN_REFRESH_PATH}`, { refresh });
    const grant = toTokenGrant(tokensResponseSchema.parse(response.data));
    setTokens(surface, grant);
    return grant.access;
  } catch (error) {
    // The server refused the refresh token (expired, revoked, rotated out):
    // the session is over. A network or 5xx failure keeps the tokens so the
    // next request can try again, and surfaces as that failure instead.
    const status = isAxiosError(error) ? error.response?.status : undefined;
    if (status !== undefined && status < HTTP_SERVER_ERROR_MIN) {
      expireSession(surface);
      return null;
    }
    throw error;
  }
}

/**
 * Rotate `surface`'s refresh token into a new pair and return the new access
 * token, or `null` when the tab has no session or the server refused it.
 * Concurrent callers share one in-flight call — a rotated-out refresh token
 * sent twice would revoke the whole session family (D-12).
 */
export function refreshAccessToken(surface: ApiSurface): Promise<string | null> {
  const existing = refreshInFlight.get(surface);
  if (existing) return existing;
  const pending = runRefresh(surface).finally(() => {
    refreshInFlight.delete(surface);
  });
  refreshInFlight.set(surface, pending);
  return pending;
}

/* ------------------------------------------------------------------ clients */

/** Which surface's token each in-flight request carried (for its 401 retry). */
const requestSurface = new WeakMap<InternalAxiosRequestConfig, ApiSurface>();

function bearer(token: string): string {
  return `${AUTH_SCHEME} ${token}`;
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
      expireSession(surface);
      throw error;
    }
    if (code !== null && !REFRESHABLE_CODES.has(code)) throw error;

    const token = await refreshAccessToken(surface);
    if (!token) {
      expireSession(surface);
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
