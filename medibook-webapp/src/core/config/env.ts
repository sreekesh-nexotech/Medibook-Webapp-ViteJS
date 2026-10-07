import { z } from 'zod';

/**
 * The app's environment, read from `import.meta.env` exactly once and
 * validated here — feature code imports these constants, never
 * `import.meta.env` itself (standards §10).
 *
 * Both base URLs are empty in local development: requests go to the dev
 * server's own origin and the Vite proxy (`vite.config.ts`) forwards `/api`
 * and `/ws` to the backend, so the backend's per-surface CORS allowlist never
 * has to know which port a worktree's dev server picked. A deployed build sets
 * them to the API origin (`https://api.example.com`), no trailing slash, or to
 * `same-origin` when the app's own host proxies `/api` and `/ws`; the build
 * refuses to run without one or the other (`vite.config.ts`, DEP-10).
 */

/** The explicit same-origin choice; at run time it means "the page's own origin". */
const SAME_ORIGIN = 'same-origin';

function originSetting(value: string): string {
  return value === SAME_ORIGIN ? '' : value.replace(/\/+$/, '');
}
const envSchema = z.object({
  VITE_API_BASE_URL: z.string().trim().default('').transform(originSetting),
  VITE_WS_BASE_URL: z.string().trim().default('').transform(originSetting),
  VITE_STORAGE_ORIGIN: z
    .string()
    .trim()
    .default('')
    .transform((v) => v.replace(/\/+$/, '')),
  VITE_MONITORING_URL: z.string().trim().default(''),
});

// Name each key: Vite inlines exactly the `import.meta.env.X` expressions it
// sees, so parsing the whole object would ship every VITE_ value — the dev
// proxy target included — in the bundle (SEC-08).
const env = envSchema.parse({
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_WS_BASE_URL: import.meta.env.VITE_WS_BASE_URL,
  VITE_STORAGE_ORIGIN: import.meta.env.VITE_STORAGE_ORIGIN,
  VITE_MONITORING_URL: import.meta.env.VITE_MONITORING_URL,
});

/** Origin of the REST API; `''` means "same origin as the page" (dev proxy). */
export const API_BASE_URL = env.VITE_API_BASE_URL;

/**
 * Origin of the WebSocket server (`wss://…`); `''` means "derive from the
 * page's own origin" (dev proxy).
 */
export const WS_BASE_URL = env.VITE_WS_BASE_URL;

/**
 * `true` under the Vite dev server. It lets a phone or tablet on the office
 * network open the dev server over plain http to check layouts; writes still
 * need https there (DEP-05).
 */
export const IS_DEV = import.meta.env.DEV;

/**
 * Origin of the file store that signed links point at (`https://…`); `''`
 * when not configured (development), which accepts any https link.
 */
export const STORAGE_ORIGIN = env.VITE_STORAGE_ORIGIN;

/**
 * Where runtime error reports are POSTed (`https://…`, OBS-01); `''` sends
 * none (`core/error/monitoring.ts`).
 */
export const MONITORING_URL = env.VITE_MONITORING_URL;
