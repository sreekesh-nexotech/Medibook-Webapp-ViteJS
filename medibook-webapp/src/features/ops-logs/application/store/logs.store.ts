import { create } from 'zustand';

import { OPS_LOGS } from './logs.fixtures';
import type { LogEntry, LogSeverity } from './logs.types';

/**
 * Compliance-log store — the platform audit trail many features' actions
 * append to (design `OpsDB.logs`). New entries are prepended with the
 * prototype's fixed demo actor/IP and a "Just now" timestamp; ids come from
 * a max+1 counter instead of the prototype's `Date.now()`.
 *
 * `logs` is **derived**, not authored: `appended` holds the entries written
 * this session and `deriveLogs` joins them onto the seeded trail, newest
 * first. That is what makes `refresh()` real work rather than a toast (audit
 * 3.1.1) — it re-runs the same derivation the screen reads and re-stamps
 * `refreshedAt`, so a Refresh picks up everything written since the screen
 * was opened instead of pretending to.
 */

/** The demo operations actor every prototype log write used. */
const DEMO_LOG_ACTOR = 'riya.sharma@medibook.in';

/** The demo console IP every prototype log write used. */
const DEMO_LOG_IP = '10.42.8.11';

/** New audit entry — actor/ip/time default to the prototype's demo values. */
export interface LogEntryDraft {
  readonly hid?: number;
  readonly action: string;
  readonly module: string;
  readonly sev: LogSeverity;
  readonly actor?: string;
  readonly ip?: string;
  readonly time?: string;
}

/** The audit trail as every screen reads it: this session's writes, then the seed. */
function deriveLogs(appended: readonly LogEntry[]): readonly LogEntry[] {
  return [...appended, ...OPS_LOGS];
}

interface LogsState {
  /** Entries written this session, newest first — the delta over the seed. */
  appended: readonly LogEntry[];
  /** Derived view: `appended` followed by the seeded trail. */
  logs: readonly LogEntry[];
  /** Epoch ms of the last derive, so screens can show a real "updated" stamp. */
  refreshedAt: number;
}

interface LogsActions {
  /** Prepend an audit entry (id minted, time "Just now" unless given). */
  addLog: (entry: LogEntryDraft) => void;
  /** Re-derive `logs` from the seed + this session's writes, and re-stamp. */
  refresh: () => void;
}

export const useLogsStore = create<LogsState & LogsActions>()((set) => ({
  appended: [],
  logs: deriveLogs([]),
  refreshedAt: Date.now(),

  addLog: (entry) =>
    set((s) => {
      const id = Math.max(0, ...s.logs.map((l) => l.id)) + 1;
      const record: LogEntry = {
        id,
        ...(entry.hid != null ? { hid: entry.hid } : {}),
        action: entry.action,
        actor: entry.actor ?? DEMO_LOG_ACTOR,
        module: entry.module,
        ip: entry.ip ?? DEMO_LOG_IP,
        time: entry.time ?? 'Just now',
        sev: entry.sev,
      };
      const appended = [record, ...s.appended];
      return { appended, logs: deriveLogs(appended) };
    }),

  refresh: () => set((s) => ({ logs: deriveLogs(s.appended), refreshedAt: Date.now() })),
}));
