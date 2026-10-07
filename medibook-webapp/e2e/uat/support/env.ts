import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Where the live UAT stack lives. Every value can be overridden from the
 * environment; the defaults are the local live stack of the UAT brief
 * (`/home/user/live/stack.sh`).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** The web app root (two levels above `e2e/uat/support`). */
export const WEB_ROOT = path.resolve(HERE, '..', '..', '..');

export const UAT_ENV = {
  /** The web app, served by Vite with its `/api` and `/ws` proxy. */
  baseUrl: process.env.UAT_BASE_URL ?? 'http://localhost:5173',
  /** The API, reached directly (setup calls, webhooks) — not through the proxy. */
  apiUrl: process.env.UAT_API_URL ?? 'http://127.0.0.1:8000',
  /** The backend checkout the live stack runs (seed output, `manage.py`). */
  backendDir: process.env.UAT_BACKEND_DIR ?? '/home/user/wt/live',
  /** The Python that runs `manage.py dev_tokens`. */
  python: process.env.UAT_PYTHON ?? '/home/user/Medibook-backend-django/.venv/bin/python',
  /** The live stack's environment file (DB, keys, provider modes). */
  liveEnvFile: process.env.UAT_LIVE_ENV ?? '/home/user/live/live.env',
  /** `RAZORPAY_WEBHOOK_SECRET` of the live stack. */
  razorpayWebhookSecret: process.env.UAT_RAZORPAY_WEBHOOK_SECRET ?? 'rzp_webhook_live_uat',
  /** Every seeded account's password (report §2.2). */
  seedPassword: process.env.UAT_SEED_PASSWORD ?? 'seed_password_123',
  /** Scratch state the suite keeps between runs (git-ignored). */
  stateDir: process.env.UAT_STATE_DIR ?? path.join(WEB_ROOT, 'e2e', '.auth', 'uat'),
  /** Where the step reporter writes its results. */
  resultsFile: process.env.UAT_RESULTS_FILE ?? path.join(WEB_ROOT, 'e2e', 'uat', 'results.json'),
} as const;

/** The API prefix every REST call carries. */
export const API_PREFIX = '/api/v1';

/** Every seeded hospital works on India Standard Time. */
export const HOSPITAL_TIME_ZONE = 'Asia/Kolkata';

/** `KEY=VALUE` lines of the live stack's env file. */
export function liveEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(UAT_ENV.liveEnvFile, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

/** The backend's default ceiling for a PDF built while you wait (M-26). */
const PDF_SYNC_MAX_ROWS_DEFAULT = 2_000;

/**
 * Report PDFs with more rows than this are built in the background and
 * emailed; the live stack lowers it with `REPORT_PDF_SYNC_MAX_ROWS`.
 */
export function pdfSyncMaxRows(): number {
  const configured = Number(liveEnv().REPORT_PDF_SYNC_MAX_ROWS);
  return Number.isFinite(configured) && configured > 0
    ? Math.min(configured, PDF_SYNC_MAX_ROWS_DEFAULT)
    : PDF_SYNC_MAX_ROWS_DEFAULT;
}
