import { afterEach, beforeEach, vi } from 'vitest';

/**
 * A desk PC whose clock runs behind the hospital's calendar (UAT-47): the PC
 * is set to UTC, the hospital is in Kolkata, and the clock is frozen at 20:00
 * UTC, when the PC still shows 7 Oct but the hospital is already on 8 Oct
 * (01:30). A helper that reads the PC's date gets `PC_DATE`; one that follows
 * the hospital (`hospitals.timezone`, D-09) gets `HOSPITAL_DATE`.
 */

/** The hospital's zone in these tests. */
export const HOSPITAL_TIME_ZONE = 'Asia/Kolkata';

/** 7 Oct 2026, 20:00 UTC. */
export const LATE_EVENING_UTC = Date.UTC(2026, 9, 7, 20, 0);

/** The date on the PC at `LATE_EVENING_UTC`. */
export const PC_DATE = '2026-10-07';

/** The hospital's date at `LATE_EVENING_UTC`. */
export const HOSPITAL_DATE = '2026-10-08';

const PC_TIME_ZONE = 'UTC';

type Env = Record<string, string | undefined>;

/**
 * The test worker's environment. The app's tsconfig carries no Node types, so
 * it is read off `globalThis`; Node re-reads the zone whenever `TZ` is set.
 */
function workerEnv(): Env {
  const env = (globalThis as unknown as { readonly process?: { readonly env: Env } }).process?.env;
  if (!env) throw new Error('The PC clock helper needs a Node test worker.');
  return env;
}

/**
 * For every test of the calling `describe`: the PC set to UTC and the clock
 * frozen at `LATE_EVENING_UTC`. The runner's own zone is put back afterwards.
 */
export function withPcBehindHospital(): void {
  let runnerZone: string | undefined;
  beforeEach(() => {
    const env = workerEnv();
    runnerZone = env.TZ;
    env.TZ = PC_TIME_ZONE;
    vi.useFakeTimers();
    vi.setSystemTime(LATE_EVENING_UTC);
  });
  afterEach(() => {
    vi.useRealTimers();
    const env = workerEnv();
    if (runnerZone === undefined) delete env.TZ;
    else env.TZ = runnerZone;
  });
}
