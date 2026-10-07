import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

import { liveEnv, UAT_ENV } from './env.ts';

/**
 * Stack readiness before the first step: the outbox backlog is drained.
 *
 * `seed_demo` drains its outbox for a minute and leaves the rest of the
 * seeded history (thousands of events) to the Celery workers once the stack
 * is up (backend `devseed/activity.py` `drain`). Until they catch up, every
 * historical `session.updated` / `appointment.*` event is pushed live to the
 * open desks, so a run that starts straight after `./stack.sh reset && up`
 * tests a stack replaying two weeks of history — not the steady state a
 * tester meets. This waits until no event is due (or fails after the limit).
 */

const run = promisify(execFile);

const POLL_MS = 15_000;
const WAIT_MAX_MS = 45 * 60_000;
const COMMAND_TIMEOUT_MS = 60_000;
/** Events due at one moment on an idle stack (beat jobs) stay under this. */
const IDLE_DUE_MAX = 10;

const DUE_COUNT_SCRIPT = [
  'from django.utils import timezone',
  'from medibook.messaging.models import OutboxEvent',
  "due = OutboxEvent.objects.filter(status__in=['pending', 'failed'], next_attempt_at__lte=timezone.now()).count()",
  "print(f'OUTBOX_DUE={due}')",
].join('\n');

async function dueEvents(): Promise<number> {
  const { stdout } = await run(
    UAT_ENV.python,
    [path.join(UAT_ENV.backendDir, 'manage.py'), 'shell', '-c', DUE_COUNT_SCRIPT],
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
  const match = /OUTBOX_DUE=(\d+)/.exec(stdout);
  if (!match?.[1]) throw new Error(`Could not read the outbox backlog:\n${stdout}`);
  return Number(match[1]);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export default async function globalSetup(): Promise<void> {
  const deadline = Date.now() + WAIT_MAX_MS;
  for (;;) {
    const due = await dueEvents();
    if (due <= IDLE_DUE_MAX) return;
    if (Date.now() > deadline) {
      throw new Error(
        `The outbox still has ${due} events due after ${WAIT_MAX_MS / 60_000} minutes: are the Celery workers running?`,
      );
    }
    process.stdout.write(`[uat] waiting for the workers to drain the outbox: ${due} events due\n`);
    await sleep(POLL_MS);
  }
}
