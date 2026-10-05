import { isFailure } from '@/core/error/failure';

import { fmtDate } from '@/shared/lib/format';
import type { OpsTint } from '@/shared/ui/OpsConfirm';

import type {
  Payout,
  PayoutRun,
  PayoutRunStatus,
  SettlementPeriod,
} from '@/features/ops-settlements/domain/entities/opsSettlements.entities';

/**
 * View model for the ops settlement queue: one row per settlement period,
 * joined to its payout and payout run, and grouped into run cards. Pure
 * functions — no fetching.
 */

/** The badge a row shows (all are keys of the shared status palette). */
export type RowStatus = 'Pending' | 'Overdue' | 'Released' | 'Payout failed' | 'On Hold';

export const ROW_STATUSES: readonly RowStatus[] = [
  'Pending',
  'Overdue',
  'Released',
  'Payout failed',
  'On Hold',
];

export interface LedgerRow {
  /** The settlement period id. */
  readonly id: string;
  readonly hospitalId: string;
  readonly hospitalName: string;
  /** "10 Jun 2026 – 16 Jun 2026". */
  readonly periodLabel: string;
  readonly periodStart: string;
  readonly grossRupees: number;
  readonly commissionRupees: number;
  readonly netRupees: number;
  /** The run's scheduled transfer date, when the period is in a run that has one. */
  readonly expected: string | null;
  readonly status: RowStatus;
  readonly payout: Payout | null;
  readonly run: PayoutRun | null;
  /** True when a UTR can be recorded for this row now. */
  readonly releasable: boolean;
}

/** Runs whose payouts can be released (`services/payouts.py` `release_run`). */
const RELEASABLE_RUN: ReadonlySet<PayoutRunStatus> = new Set([
  'approved',
  'processing',
  'partially_failed',
]);

export const RUN_STATUS_LABEL: Readonly<Record<PayoutRunStatus, string>> = {
  draft: 'Draft — needs approval',
  approved: 'Approved — ready to release',
  processing: 'Releasing',
  released: 'Released',
  partially_failed: 'Partially failed',
  failed: 'Failed',
};

function rowStatus(
  period: SettlementPeriod,
  payout: Payout | null,
  run: PayoutRun | null,
  today: string,
): RowStatus {
  if (period.status === 'paid' || payout?.status === 'released') return 'Released';
  if (payout?.status === 'failed') return 'Payout failed';
  if (payout?.status === 'on_hold' || period.status === 'on_hold') return 'On Hold';
  if (run?.scheduledFor && run.scheduledFor < today) return 'Overdue';
  return 'Pending';
}

/**
 * One row per closed, held or paid period (open periods are still accruing
 * and are not statements yet), joined to its payout and run.
 */
export function buildRows(
  periods: readonly SettlementPeriod[],
  payouts: readonly Payout[],
  runs: readonly PayoutRun[],
  today: string,
): LedgerRow[] {
  const payoutByPeriod = new Map(payouts.map((p) => [p.settlementPeriodId, p] as const));
  const runById = new Map(runs.map((r) => [r.id, r] as const));
  return periods
    .filter((p) => p.status !== 'open')
    .map((p) => {
      const payout = payoutByPeriod.get(p.id) ?? null;
      const run = payout ? (runById.get(payout.payoutRunId) ?? null) : null;
      return {
        id: p.id,
        hospitalId: p.hospitalId,
        hospitalName: p.hospitalName,
        periodLabel: `${fmtDate(p.periodStart)} – ${fmtDate(p.periodEnd)}`,
        periodStart: p.periodStart,
        grossRupees: p.grossRupees,
        commissionRupees: p.commissionRupees,
        netRupees: p.netPayableRupees,
        expected: run?.scheduledFor ?? null,
        status: rowStatus(p, payout, run, today),
        payout,
        run,
        releasable:
          payout !== null &&
          payout.status !== 'released' &&
          run !== null &&
          RELEASABLE_RUN.has(run.status),
      };
    });
}

/** A run card: a real payout run, or (`run: null`) closed periods not in any run yet. */
export interface RunGroup {
  readonly key: string;
  readonly run: PayoutRun | null;
  readonly rows: readonly LedgerRow[];
}

/** Unassigned periods first (they need a run), then runs newest first. */
export function groupRows(rows: readonly LedgerRow[], runs: readonly PayoutRun[]): RunGroup[] {
  const groups: RunGroup[] = [];
  const unassigned = rows.filter((r) => r.run === null && r.status !== 'Released');
  if (unassigned.length > 0) groups.push({ key: 'unassigned', run: null, rows: unassigned });
  runs.forEach((run) => {
    const own = rows.filter((r) => r.run?.id === run.id);
    if (own.length > 0) groups.push({ key: run.id, run, rows: own });
  });
  return groups;
}

/** Periods a new run would pick up: closed, not in a run, with something to pay. */
export function runnablePeriods(rows: readonly LedgerRow[]): LedgerRow[] {
  return rows.filter((r) => r.run === null && r.status === 'Pending' && r.netRupees > 0);
}

/** The smallest window covering `rows`' periods (for creating a run over them). */
export function windowOf(
  rows: readonly LedgerRow[],
  periods: readonly SettlementPeriod[],
): { start: string; end: string } | null {
  const ids = new Set(rows.map((r) => r.id));
  const own = periods.filter((p) => ids.has(p.id));
  if (own.length === 0) return null;
  return {
    start: own.map((p) => p.periodStart).reduce((a, b) => (a < b ? a : b)),
    end: own.map((p) => p.periodEnd).reduce((a, b) => (a > b ? a : b)),
  };
}

/** Ops accent tint cycle (design `opsTintOf`). */
const OPS_TINT_CYCLE: readonly OpsTint[] = ['primary', 'info', 'success', 'warning', 'neutral'];

export function opsTintOf(i: number): OpsTint {
  return OPS_TINT_CYCLE[i % OPS_TINT_CYCLE.length] ?? 'primary';
}

const ISO_DATE_LENGTH = 10;

/** ISO date-time → its date part, for `fmtDate`. */
export function datePart(iso: string | null): string | null {
  return iso ? iso.slice(0, ISO_DATE_LENGTH) : null;
}

/** "•••• 1234", or `null` when no payout account was on file. */
export function bankLabel(payout: Payout | null): string | null {
  return payout?.bankAccountLast4 ? `A/c ····${payout.bankAccountLast4}` : null;
}

/** First field message of a 400, else the failure's own message, else `fallback`. */
export function failureText(error: unknown, fallback: string): string {
  if (!isFailure(error)) return fallback;
  const firstField = Object.values(error.fieldErrors)[0]?.[0];
  return firstField ?? error.message;
}
