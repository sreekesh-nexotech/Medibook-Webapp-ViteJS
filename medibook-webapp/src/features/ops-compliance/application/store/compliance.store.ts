import { create } from 'zustand';

import { fmtDate } from '@/shared/lib/format';

import { useLogsStore } from '@/features/ops-logs/application/store/logs.store';

import {
  CONFIG_CHANGES,
  EXPORT_REQUESTS,
  EXPORT_REQUEST_SERIES_YEAR,
  STAFF_LOGINS,
} from './compliance.fixtures';
import type {
  ConfigChange,
  ExportRequest,
  ExportStatus,
  ExportSubjectKind,
  StaffLogin,
} from './compliance.types';

/**
 * Compliance store — staff login history, the configuration-change log with
 * before → after values, and export-on-request records (audit 2.5 / SA-06).
 *
 * Two things here are deliberate:
 *
 *  1. `recordChange` is called by the screens that actually change settings
 *     (Platform Settings today), so the change log is live rather than a
 *     frozen list: what you edit shows up with its real old and new value.
 *  2. An export is a **record with a status**, not an assumption. `openExport`
 *     files it as `Preparing`; `settleExport` moves it to `Completed` only
 *     when a file has been written, and to `No data` when the request matched
 *     nothing — in which case nothing claims otherwise.
 *
 * Timestamps are assembled from local calendar parts, never from
 * `Date.toISOString()` on a local midnight.
 */

/** Compliance-log module name for compliance actions. */
const COMPLIANCE_LOG_MODULE = 'Compliance';

/** Width of the export-request sequence, e.g. `DSR-2026-0004`. */
const EXPORT_SEQ_WIDTH = 4;

/** Local calendar date as ISO `yyyy-mm-dd` — no UTC round trip. */
function localIsoDate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Local wall-clock time as `HH:mm`. */
function localTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** The next id in the `DSR-<year>-<seq>` series. */
function nextExportId(existing: readonly ExportRequest[]): string {
  const seq =
    existing.reduce((max, r) => {
      const n = Number.parseInt(r.id.slice(r.id.lastIndexOf('-') + 1), 10);
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 0) + 1;
  return `DSR-${EXPORT_REQUEST_SERIES_YEAR}-${String(seq).padStart(EXPORT_SEQ_WIDTH, '0')}`;
}

/** A configuration change as the screen that made it knows it. */
export interface ConfigChangeDraft {
  readonly actor: string;
  readonly area: string;
  readonly setting: string;
  readonly before: string;
  readonly after: string;
  readonly scope: ConfigChange['scope'];
  readonly hid?: number | null;
}

/** What an export was asked for. */
export interface ExportRequestInput {
  readonly kind: ExportSubjectKind;
  readonly subject: string;
  readonly subjectKey: string;
  readonly from: string;
  readonly to: string;
  readonly requestedBy: string;
}

/** How an export finished. */
export interface ExportOutcome {
  readonly status: Exclude<ExportStatus, 'Preparing'>;
  readonly rows: number;
  readonly file: string | null;
}

interface ComplianceState {
  logins: readonly StaffLogin[];
  changes: readonly ConfigChange[];
  requests: readonly ExportRequest[];
  /** Epoch ms of the last derive, so the screen can show a real "updated" stamp. */
  refreshedAt: number;
}

interface ComplianceActions {
  /** Re-derive the three record sets and re-stamp (the Refresh control). */
  refresh: () => void;
  /** Append a configuration change with its before → after pair. */
  recordChange: (draft: ConfigChangeDraft) => void;
  /** File an export request as `Preparing`; returns its minted id. */
  openExport: (input: ExportRequestInput) => string;
  /** Close an export request with what actually happened. */
  settleExport: (id: string, outcome: ExportOutcome) => void;
}

export const useComplianceStore = create<ComplianceState & ComplianceActions>()((set, get) => ({
  logins: STAFF_LOGINS,
  changes: CONFIG_CHANGES,
  requests: EXPORT_REQUESTS,
  refreshedAt: Date.now(),

  refresh: () =>
    set((s) => ({
      logins: [...s.logins],
      changes: [...s.changes],
      requests: [...s.requests],
      refreshedAt: Date.now(),
    })),

  recordChange: (draft) =>
    set((s) => {
      const now = new Date();
      const record: ConfigChange = {
        id: Math.max(0, ...s.changes.map((c) => c.id)) + 1,
        date: localIsoDate(now),
        time: localTime(now),
        actor: draft.actor,
        area: draft.area,
        setting: draft.setting,
        before: draft.before,
        after: draft.after,
        scope: draft.scope,
        ...(draft.hid != null ? { hid: draft.hid } : {}),
      };
      return { changes: [record, ...s.changes] };
    }),

  openExport: (input) => {
    const now = new Date();
    const id = nextExportId(get().requests);
    const record: ExportRequest = {
      id,
      kind: input.kind,
      subject: input.subject,
      subjectKey: input.subjectKey,
      from: input.from,
      to: input.to,
      requestedBy: input.requestedBy,
      requestedAt: `${fmtDate(localIsoDate(now))} · ${localTime(now)}`,
      status: 'Preparing',
      rows: 0,
      file: null,
    };
    set((s) => ({ requests: [record, ...s.requests] }));
    return id;
  },

  settleExport: (id, outcome) => {
    const req = get().requests.find((r) => r.id === id);
    if (!req) return;
    set((s) => ({
      requests: s.requests.map((r) =>
        r.id === id ? { ...r, status: outcome.status, rows: outcome.rows, file: outcome.file } : r,
      ),
    }));
    useLogsStore.getState().addLog({
      ...(req.kind === 'Hospital' && req.subjectKey.startsWith('hospital:')
        ? { hid: Number(req.subjectKey.slice('hospital:'.length)) }
        : {}),
      action:
        outcome.status === 'Completed'
          ? `Data-subject export ${id} — ${req.subject} · ${outcome.rows} rows (CSV)`
          : `Data-subject export ${id} — ${req.subject} · no records in range`,
      module: COMPLIANCE_LOG_MODULE,
      sev: outcome.status === 'Completed' ? 'Warning' : 'Info',
    });
  },
}));
