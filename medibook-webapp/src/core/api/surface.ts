/**
 * The two authenticated API surfaces this web app talks to. Each has its own
 * token pair: a hospital token is refused on `/platform/…` and vice versa
 * (backend `AUTH_PRINCIPAL_MISMATCH`, D-10).
 */
export type ApiSurface = 'hospital' | 'platform';

/**
 * URL prefix of the ops console. Mirrors `OPS_BASE_PATH` in
 * `src/app/router/paths.ts` — `core` must not import from `app`, so the value
 * is restated here and the two must change together.
 */
const OPS_PATH_PREFIX = '/ops';

/**
 * The surface the user is working in right now, from the page URL: the ops
 * console (`/ops/…`) uses the platform token, every other route the hospital
 * token. Used by `/shared/*` calls, which accept either principal.
 */
export function activeSurface(): ApiSurface {
  const path = typeof window === 'undefined' ? '' : window.location.pathname;
  return path === OPS_PATH_PREFIX || path.startsWith(`${OPS_PATH_PREFIX}/`)
    ? 'platform'
    : 'hospital';
}
