import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { UAT_ENV } from './env.ts';

/**
 * Sign-in pacing. The backend allows 10 sign-ins a minute per address and 5
 * per account (v1 §7.1); every call of this suite comes from 127.0.0.1, so
 * sign-ins through the UI and through the API share one budget. Each one waits
 * here until it fits, with a margin. The log is a file so the budget survives
 * a worker restart.
 */

const WINDOW_MS = 61_000;
const MAX_PER_ADDRESS = 8;
const MAX_PER_ACCOUNT = 4;
const POLL_MS = 1_000;

interface AuthAttempt {
  readonly at: number;
  readonly identifier: string;
}

const LOG_FILE = () => path.join(UAT_ENV.stateDir, 'auth-log.json');

function readLog(): AuthAttempt[] {
  try {
    const log = JSON.parse(readFileSync(LOG_FILE(), 'utf-8')) as AuthAttempt[];
    return log.filter((a) => Date.now() - a.at < WINDOW_MS);
  } catch {
    // No log yet: nothing has been spent.
    return [];
  }
}

function writeLog(log: readonly AuthAttempt[]): void {
  mkdirSync(UAT_ENV.stateDir, { recursive: true });
  writeFileSync(LOG_FILE(), JSON.stringify(log));
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Wait until one more sign-in for `identifier` fits the limits, then record it. */
export async function spendSignIn(identifier: string): Promise<void> {
  const key = identifier.toLowerCase();
  for (;;) {
    const log = readLog();
    const forAccount = log.filter((a) => a.identifier === key).length;
    if (log.length < MAX_PER_ADDRESS && forAccount < MAX_PER_ACCOUNT) {
      writeLog([...log, { at: Date.now(), identifier: key }]);
      return;
    }
    await sleep(POLL_MS);
  }
}
