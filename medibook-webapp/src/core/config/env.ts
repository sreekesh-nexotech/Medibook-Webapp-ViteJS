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
 * them to the API origin (`https://api.example.com`), no trailing slash.
 */
const envSchema = z.object({
  VITE_API_BASE_URL: z
    .string()
    .trim()
    .default('')
    .transform((v) => v.replace(/\/+$/, '')),
  VITE_WS_BASE_URL: z
    .string()
    .trim()
    .default('')
    .transform((v) => v.replace(/\/+$/, '')),
  VITE_STORAGE_ORIGIN: z
    .string()
    .trim()
    .default('')
    .transform((v) => v.replace(/\/+$/, '')),
});

// Name each key: Vite inlines exactly the `import.meta.env.X` expressions it
// sees, so parsing the whole object would ship every VITE_ value — the dev
// proxy target included — in the bundle (SEC-08).
const env = envSchema.parse({
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_WS_BASE_URL: import.meta.env.VITE_WS_BASE_URL,
  VITE_STORAGE_ORIGIN: import.meta.env.VITE_STORAGE_ORIGIN,
});

/** Origin of the REST API; `''` means "same origin as the page" (dev proxy). */
export const API_BASE_URL = env.VITE_API_BASE_URL;

/**
 * Origin of the WebSocket server (`wss://…`); `''` means "derive from the
 * page's own origin" (dev proxy).
 */
export const WS_BASE_URL = env.VITE_WS_BASE_URL;

/**
 * Origin of the file store that signed links point at (`https://…`); `''`
 * when not configured (development), which accepts any https link.
 */
export const STORAGE_ORIGIN = env.VITE_STORAGE_ORIGIN;
