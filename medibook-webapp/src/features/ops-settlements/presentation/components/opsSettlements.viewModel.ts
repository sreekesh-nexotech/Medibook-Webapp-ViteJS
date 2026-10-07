import { isFailure } from '@/core/error/failure';

import { downloadFromUrl } from '@/shared/lib/download';
import { fmtDate } from '@/shared/lib/format';
import type { OpsTint } from '@/shared/ui/OpsConfirm';

import type {
  Payout,
  PayoutRun,
  PayoutRunStatus,
  PeriodBreakdown,
  SettlementFile,
  SettlementPeriod,
  StatementPdf,
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

/**
 * A payout that can actually be released: an account was captured and is
 * still verified (M-45 — the backend refuses a release to an account whose
 * verification was lost). `null` verification (older backend) is not held
 * against it.
 */
export function canReleaseTo(payout: Payout | null): boolean {
  return payout !== null && payout.hasBankAccount && payout.bankAccountVerified !== false;
}

/** Why a releasable row's money cannot go out, or `null` when it can. */
export function releaseBlocker(payout: Payout | null): string | null {
  if (!payout) return null;
  if (!payout.hasBankAccount) return 'no payout account';
  if (payout.bankAccountVerified === false) return 'account no longer verified';
  return null;
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
 * One row per closed, held or paid period, joined to its payout and run.
 * Periods are only created closed now (decision 11); a legacy `open` row is
 * not a statement and is left out.
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

/** Run skip reasons (M-45), as ops read them. */
const RUN_SKIP_LABELS: Readonly<Record<string, string>> = {
  no_primary_bank_account: 'no primary payout account',
  bank_account_unverified: 'payout account not verified yet',
};

export function runSkipLabel(reason: string): string {
  return RUN_SKIP_LABELS[reason] ?? reason.replace(/_/g, ' ');
}

/** Period-close skip reasons. */
const CLOSE_SKIP_LABELS: Readonly<Record<string, string>> = {
  overlaps_existing_period: 'already has a period overlapping these dates',
};

export function closeSkipLabel(reason: string): string {
  return CLOSE_SKIP_LABELS[reason] ?? reason.replace(/_/g, ' ');
}

/** Decision 3: with `payout_four_eyes` on, the run's creator may not approve or release it. */
export function isFourEyesRefusal(error: unknown): boolean {
  return (
    isFailure(error) && error.code === 'PERMISSION_DENIED' && error.meta.rule === 'payout_four_eyes'
  );
}

const FOUR_EYES_MESSAGE =
  'Four-eyes approval is on: someone other than the person who created this run must approve and release it.';

/**
 * First field message of a 400, else a message for the refusals this screen
 * knows (four-eyes, a run with nothing payable), else the failure's own
 * message, else `fallback`.
 */
export function failureText(error: unknown, fallback: string): string {
  if (!isFailure(error)) return fallback;
  if (isFourEyesRefusal(error)) return FOUR_EYES_MESSAGE;
  const skipped = error.meta.skipped;
  if (error.code === 'STATE_CONFLICT' && Array.isArray(skipped) && skipped.length > 0) {
    return `No payout run was created: none of the ${skipped.length} statement${
      skipped.length === 1 ? '' : 's'
    } in that window can be paid until the hospital's primary payout account is verified.`;
  }
  const firstField = Object.values(error.fieldErrors)[0]?.[0];
  return firstField ?? error.message;
}

export interface BreakdownLine {
  readonly label: string;
  /** Signed rupees: deductions are negative. */
  readonly rupees: number;
  readonly strong?: boolean;
}

/**
 * The drawer's statement lines, top to bottom: what came in, what came off,
 * and the payable. Lines that are zero and optional are left out.
 */
export function breakdownLines(
  b: PeriodBreakdown,
  adjustmentsRupees: number,
  tdsRupees: number,
  netPayableRupees: number,
): BreakdownLine[] {
  const lines: BreakdownLine[] = [
    { label: 'Gross collected', rupees: b.grossRupees },
    { label: 'Refunds', rupees: -b.refundsRupees },
    { label: 'Gateway fees', rupees: -b.gatewayFeesRupees },
    { label: 'Platform commission', rupees: -b.commissionRupees },
  ];
  if (b.commissionGstRupees !== 0) {
    lines.push({ label: 'GST on commission', rupees: -b.commissionGstRupees });
  }
  if (b.carriedAdjustmentsRupees !== 0) {
    lines.push({ label: 'Adjustments carried in', rupees: b.carriedAdjustmentsRupees });
  }
  lines.push({ label: 'Ledger net', rupees: b.ledgerNetRupees, strong: true });
  if (adjustmentsRupees !== 0) lines.push({ label: 'Adjustments', rupees: adjustmentsRupees });
  if (tdsRupees !== 0) lines.push({ label: 'TDS', rupees: -tdsRupees });
  lines.push({ label: 'Net payable', rupees: netPayableRupees, strong: true });
  return lines;
}

/** `true` / `false` from the backend's reconciliation, or computed on an older backend. */
export function isReconciled(
  b: PeriodBreakdown,
  adjustmentsRupees: number,
  tdsRupees: number,
  netPayableRupees: number,
): boolean {
  if (b.reconciled !== null) return b.reconciled;
  const expected = b.ledgerNetRupees + adjustmentsRupees - tdsRupees;
  return Math.round(expected * 100) === Math.round(netPayableRupees * 100);
}

/** `"1,250.50"` → 1250.5; `undefined` unless an amount above zero with at most two decimals. */
export function parseAdjustmentAmount(raw: string): number | undefined {
  const text = raw.replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return undefined;
  const n = Number(text);
  return n > 0 ? n : undefined;
}

/** How long a downloaded file's object URL is kept alive. */
const REVOKE_DELAY_MS = 10_000;

/** Hand a server-rendered file (export, PDF bytes) to the browser's download. */
export function saveSettlementFile(file: SettlementFile): void {
  const url = URL.createObjectURL(file.blob);
  downloadFromUrl(url, file.filename);
  // Revoking in the same tick can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

/** Open a statement PDF: follow the signed link (SET-02), or save the bytes. */
export function openStatementPdf(pdf: StatementPdf): void {
  if (pdf.kind === 'url') downloadFromUrl(pdf.url, `${pdf.statementNo}.pdf`);
  else saveSettlementFile(pdf.file);
}

const HTTP_NOT_IMPLEMENTED = 501;

/** The server cannot render PDFs here (`501 NOT_IMPLEMENTED_YET`). */
export function isNotImplemented(error: unknown): boolean {
  return isFailure(error) && error.status === HTTP_NOT_IMPLEMENTED;
}

/** The month before `todayIso`, as `YYYY-MM` — the usual month to issue statements for. */
export function previousMonth(todayIso: string): string {
  const [y, m] = todayIso.split('-').map(Number);
  const year = y ?? 1970;
  const month = m ?? 1;
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
}
