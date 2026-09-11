import { create } from 'zustand';

import { useLogsStore } from '@/features/ops-logs/application/store/logs.store';

import { OPS_REPORTS_GEN } from './opsReports.fixtures';

/**
 * Ops reports store — the last-generated date per report card, index-aligned
 * with `OPS_REPORT_DEFS` (design `OpsDB.reportsGen`). Exporting a report
 * stamps its entry "just now" and writes the audit line the seeded trail
 * already shows for data exports; the toast comes from the screen's
 * `useOpsAct` run, after the file has actually been written.
 */

/** Compliance-log module name for report exports. */
const REPORTS_LOG_MODULE = 'Reports';

interface OpsReportsState {
  reportsGen: readonly string[];
}

interface OpsReportsActions {
  /** Stamp report `i` as generated "just now" and log the export. */
  markExported: (i: number, name: string, rows: number) => void;
}

export const useOpsReportsStore = create<OpsReportsState & OpsReportsActions>()((set) => ({
  reportsGen: OPS_REPORTS_GEN,
  markExported: (i, name, rows) => {
    set((s) => ({ reportsGen: s.reportsGen.map((d, idx) => (idx === i ? 'just now' : d)) }));
    useLogsStore.getState().addLog({
      action: `Data export — ${name} · ${rows} rows (CSV)`,
      module: REPORTS_LOG_MODULE,
      sev: 'Warning',
    });
  },
}));
