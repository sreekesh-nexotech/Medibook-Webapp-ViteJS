import { describe, expect, it } from 'vitest';

import type { Failure } from '@/core/error/failure';

import type {
  Payout,
  PayoutRun,
  PeriodBreakdown,
  SettlementPeriod,
} from '@/features/ops-settlements/domain/entities/opsSettlements.entities';
import {
  breakdownLines,
  buildRows,
  canReleaseTo,
  failureText,
  isFourEyesRefusal,
  isReconciled,
  parseAdjustmentAmount,
  previousMonth,
  releaseBlocker,
  runSkipLabel,
} from '@/features/ops-settlements/presentation/components/opsSettlements.viewModel';

function failure(over: Partial<Failure>): Failure {
  return {
    kind: 'forbidden',
    message: 'Not allowed.',
    code: null,
    status: 403,
    fieldErrors: {},
    requestId: null,
    meta: {},
    ...over,
  };
}

const period = (over: Partial<SettlementPeriod>): SettlementPeriod => ({
  id: 'p-1',
  hospitalId: 'h-1',
  hospitalName: 'City Care',
  periodStart: '2026-09-01',
  periodEnd: '2026-09-30',
  status: 'closed',
  grossRupees: 10_000,
  refundsRupees: 500,
  gatewayFeesRupees: 200,
  commissionRupees: 1_180,
  adjustmentsRupees: 100,
  tdsRupees: 0,
  netPayableRupees: 8_220,
  ...over,
});

const payout = (over: Partial<Payout>): Payout => ({
  id: 'po-1',
  payoutRunId: 'run-1',
  settlementPeriodId: 'p-1',
  hospitalId: 'h-1',
  bankAccountLast4: '1234',
  hasBankAccount: true,
  amountRupees: 8_220,
  status: 'pending',
  utrRef: null,
  releasedAt: null,
  failureReason: null,
  notes: null,
  runNo: 'PR-2026-0001',
  runStatus: 'approved',
  hospitalName: 'City Care',
  periodStart: '2026-09-01',
  periodEnd: '2026-09-30',
  bankAccountVerified: true,
  ...over,
});

const run: PayoutRun = {
  id: 'run-1',
  runNo: 'PR-2026-0001',
  status: 'approved',
  periodStart: '2026-09-01',
  periodEnd: '2026-09-30',
  scheduledFor: null,
  approvedAt: '2026-10-02T05:00:00Z',
  releasedAt: null,
  totalRupees: 8_220,
  hospitalCount: 1,
  notes: null,
  initiatedById: 'u-1',
};

const breakdown: PeriodBreakdown = {
  grossRupees: 10_000,
  refundsRupees: 500,
  gatewayFeesRupees: 200,
  commissionRupees: 1_000,
  commissionGstRupees: 180,
  convenienceFeesRupees: 300,
  convenienceFeeGstRupees: 54,
  carriedAdjustmentsRupees: 0,
  ledgerNetRupees: 8_120,
  bookingsCount: 40,
  entries: 120,
  lateEntries: 0,
  expectedNetRupees: null,
  differenceRupees: null,
  reconciled: null,
};

describe('failureText (decision 3, M-45)', () => {
  it('explains the four-eyes refusal', () => {
    const refusal = failure({
      code: 'PERMISSION_DENIED',
      meta: { rule: 'payout_four_eyes', initiated_by_id: 'u-1' },
    });
    expect(isFourEyesRefusal(refusal)).toBe(true);
    expect(failureText(refusal, 'x')).toMatch(/someone other than the person who created/);
  });

  it('explains a run where nothing was payable', () => {
    const conflict = failure({
      kind: 'conflict',
      status: 409,
      code: 'STATE_CONFLICT',
      meta: { skipped: [{ hospital_id: 'h-1', reason: 'bank_account_unverified' }] },
    });
    expect(failureText(conflict, 'x')).toMatch(/payout account is verified/);
  });

  it('prefers a field message, then the server message', () => {
    const invalid = failure({
      kind: 'validation',
      status: 400,
      code: 'VALIDATION_ERROR',
      fieldErrors: { period_end: ['Must be before today.'] },
    });
    expect(failureText(invalid, 'x')).toBe('Must be before today.');
    expect(failureText(failure({ message: 'Overlaps.' }), 'x')).toBe('Overlaps.');
    expect(failureText(new Error('boom'), 'fallback')).toBe('fallback');
  });
});

describe('releasing to a verified account (M-45)', () => {
  it('blocks a missing or no-longer-verified account', () => {
    expect(canReleaseTo(payout({}))).toBe(true);
    expect(canReleaseTo(payout({ bankAccountVerified: null }))).toBe(true);
    expect(canReleaseTo(payout({ bankAccountVerified: false }))).toBe(false);
    expect(releaseBlocker(payout({ bankAccountVerified: false }))).toBe(
      'account no longer verified',
    );
    expect(releaseBlocker(payout({ hasBankAccount: false }))).toBe('no payout account');
    expect(canReleaseTo(null)).toBe(false);
  });

  it('labels run skip reasons', () => {
    expect(runSkipLabel('bank_account_unverified')).toBe('payout account not verified yet');
    expect(runSkipLabel('something_new')).toBe('something new');
  });
});

describe('buildRows (decision 11)', () => {
  it('leaves out a legacy open period and joins payouts to runs', () => {
    const rows = buildRows(
      [period({}), period({ id: 'p-2', status: 'open' })],
      [payout({})],
      [run],
      '2026-10-07',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 'p-1', status: 'Pending', releasable: true });
  });
});

describe('breakdown (BE-27)', () => {
  it('lists the statement lines with deductions negative', () => {
    const lines = breakdownLines(breakdown, 100, 0, 8_220);
    expect(lines.map((l) => [l.label, l.rupees])).toEqual([
      ['Gross collected', 10_000],
      ['Refunds', -500],
      ['Gateway fees', -200],
      ['Platform commission', -1_000],
      ['GST on commission', -180],
      ['Ledger net', 8_120],
      ['Adjustments', 100],
      ['Net payable', 8_220],
    ]);
  });

  it('uses the server reconciliation, or checks ledger + adjustments − TDS', () => {
    expect(isReconciled(breakdown, 100, 0, 8_220)).toBe(true);
    expect(isReconciled(breakdown, 0, 0, 8_220)).toBe(false);
    expect(isReconciled({ ...breakdown, reconciled: false }, 100, 0, 8_220)).toBe(false);
  });
});

describe('form helpers', () => {
  it('parses an adjustment amount', () => {
    expect(parseAdjustmentAmount('1,250.50')).toBe(1250.5);
    expect(parseAdjustmentAmount('0')).toBeUndefined();
    expect(parseAdjustmentAmount('-5')).toBeUndefined();
    expect(parseAdjustmentAmount('1.234')).toBeUndefined();
  });

  it('picks the previous month to issue', () => {
    expect(previousMonth('2026-10-07')).toBe('2026-09');
    expect(previousMonth('2026-01-15')).toBe('2025-12');
  });
});
