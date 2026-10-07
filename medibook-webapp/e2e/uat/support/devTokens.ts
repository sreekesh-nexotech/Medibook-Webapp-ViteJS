import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

import { UAT_ENV } from './env.ts';

/**
 * The emailed-link bridge (BE-02): the live stack runs with fake email, so the
 * links a tester would open from their inbox are read with
 * `manage.py dev_tokens <email> --json`, which prints every live reset,
 * set-password and invitation token for that person with the exact emailed
 * link.
 */

const run = promisify(execFile);

const POLL_MS = 1_000;
const DEFAULT_WAIT_MS = 30_000;
const COMMAND_TIMEOUT_MS = 60_000;

export interface DevToken {
  readonly kind: 'password_reset' | 'invitation';
  readonly email: string;
  readonly surface?: 'hospital' | 'platform';
  readonly issued_via?: string;
  readonly issued_at: string;
  readonly expires_at: string;
  readonly token: string;
  readonly link: string;
  readonly hospital?: string;
  readonly role?: string;
}

interface DevTokensOutput {
  readonly identifier: string;
  readonly tokens: readonly DevToken[];
}

/** `KEY=VALUE` lines of the live stack's env file. */
function liveEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(UAT_ENV.liveEnvFile, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

/** Every live emailed token for `email`, newest first. */
export async function devTokens(email: string): Promise<readonly DevToken[]> {
  const { stdout } = await run(
    UAT_ENV.python,
    [path.join(UAT_ENV.backendDir, 'manage.py'), 'dev_tokens', email, '--json'],
    {
      cwd: UAT_ENV.backendDir,
      timeout: COMMAND_TIMEOUT_MS,
      env: {
        ...process.env,
        ...liveEnv(),
        DB_ROLE: 'owner',
        PYTHONPATH: UAT_ENV.backendDir,
        DJANGO_SETTINGS_MODULE: 'medibook.settings.base',
      },
    },
  );
  const start = stdout.indexOf('{');
  const parsed = JSON.parse(stdout.slice(start)) as DevTokensOutput;
  return parsed.tokens;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The newest token of `kind` for `email` issued at or after `since` — waits for
 * it, since the email is written by the request but delivered by a worker.
 */
export async function waitForDevToken(
  email: string,
  kind: DevToken['kind'],
  since: Date,
  waitMs = DEFAULT_WAIT_MS,
): Promise<DevToken> {
  const deadline = Date.now() + waitMs;
  // Issued-at stamps are server time; allow a little clock skew.
  const floor = since.getTime() - POLL_MS * 5;
  for (;;) {
    const match = (await devTokens(email)).find(
      (t) => t.kind === kind && Date.parse(t.issued_at) >= floor,
    );
    if (match) return match;
    if (Date.now() > deadline) {
      throw new Error(`No ${kind} link was emailed to ${email} within ${waitMs / 1000}s.`);
    }
    await sleep(POLL_MS);
  }
}

/** The emailed link, re-pointed at the web app under test (same path and query). */
export function linkOnBase(link: string, baseUrl: string): string {
  const url = new URL(link);
  return `${baseUrl.replace(/\/$/, '')}${url.pathname}${url.search}`;
}
