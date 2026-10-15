import { describe, expect, it } from 'vitest';

import { toAdjustmentCreateRequest } from '@/features/ops-settlements/infrastructure/data-sources/remote/opsSettlements.request';
import {
  payoutRunCreatedResponseSchema,
  periodCloseResponseSchema,
  periodDetailResponseSchema,
  statementResponseSchema,
  toPayoutRunCreated,
  toPeriodCloseOutcome,
  toPeriodDetail,
  toPlatformStatement,
} from '@/features/ops-settlements/infrastructure/data-sources/remote/opsSettlements.response';

const periodRow = {
  id: 'p-1',
  hospital_id: 'h-1',
  hospital_name: 'City Care',
  period_start: '2026-09-01',
  period_end: '2026-09-30',
  status: 'closed',
  gross_paise: 1_000_000,
  refunds_paise: 50_000,
  gateway_fees_paise: 20_000,
  commission_paise: 118_000,
  adjustments_paise: 10_000,
  tds_paise: 0,
  net_payable_paise: 822_000,
};

const breakdown = {
  gross_paise: 1_000_000,
  refunds_paise: 50_000,
  gateway_fees_paise: 20_000,
  commission_paise: 100_000,
  commission_gst_paise: 18_000,
  ledger_net_paise: 812_000,
  bookings_count: 40,
  entries: 120,
};

describe('period close response (BE-27)', () => {
  it('reads a dry run as a preview', () => {
    const outcome = toPeriodCloseOutcome(
      periodCloseResponseSchema.parse({
        dry_run: true,
        would_close: [
          {
            hospital_id: 'h-1',
            hospital_name: 'City Care',
            period_start: '2026-09-01',
            period_end: '2026-09-30',
            net_payable_paise: 812_000,
            breakdown,
          },
        ],
        skipped: [{ hospital_id: 'h-2', reason: 'overlaps_existing_period' }],
      }),
    );
    expect(outcome.kind).toBe('preview');
    if (outcome.kind !== 'preview') return;
    expect(outcome.wouldClose[0]).toMatchObject({ netPayableRupees: 8_120 });
    expect(outcome.wouldClose[0]?.breakdown?.bookingsCount).toBe(40);
    expect(outcome.skipped).toEqual([{ hospitalId: 'h-2', reason: 'overlaps_existing_period' }]);
  });

  it('reads a confirmed close, and flags an older backend that closed without a preview', () => {
    const confirmed = toPeriodCloseOutcome(
      periodCloseResponseSchema.parse({ dry_run: false, closed: [periodRow], skipped: [] }),
    );
    expect(confirmed).toMatchObject({ kind: 'closed', legacy: false });
    const legacy = toPeriodCloseOutcome(
      periodCloseResponseSchema.parse({ closed: [periodRow], skipped: [] }),
    );
    expect(legacy).toMatchObject({ kind: 'closed', legacy: true });
  });
});

describe('period detail (BE-27, UAT-29)', () => {
  it('maps breakdown, adjustments, payout and statements', () => {
    const detail = toPeriodDetail(
      periodDetailResponseSchema.parse({
        ...periodRow,
        closed_at: '2026-10-01T04:00:00Z',
        breakdown: {
          ...breakdown,
          expected_net_paise: 822_000,
          difference_paise: 0,
          reconciled: true,
        },
        adjustments: [
          {
            id: 'a-1',
            amount_paise: -5_000,
            reason: 'Duplicate refund',
            carried_forward: true,
            created_at: '2026-10-02T04:00:00Z',
          },
        ],
        payout: null,
        statement_id: 's-1',
        statements: [
          {
            id: 's-1',
            statement_no: 'STM-2026-0009',
            period_start: '2026-09-01',
            period_end: '2026-09-30',
            issued_at: '2026-10-01T02:00:00Z',
          },
        ],
      }),
    );
    expect(detail.breakdown).toMatchObject({ reconciled: true, differenceRupees: 0 });
    expect(detail.adjustments[0]).toMatchObject({ amountRupees: -50, carriedForward: true });
    expect(detail.statements[0]?.statementNo).toBe('STM-2026-0009');
    expect(detail.statementId).toBe('s-1');
  });

  it('copes with an older backend without the new fields', () => {
    const detail = toPeriodDetail(periodDetailResponseSchema.parse(periodRow));
    expect(detail).toMatchObject({
      breakdown: null,
      adjustments: [],
      payout: null,
      statements: [],
    });
  });
});

describe('payout run create (M-45)', () => {
  it('keeps the skipped periods', () => {
    const created = toPayoutRunCreated(
      payoutRunCreatedResponseSchema.parse({
        id: 'run-1',
        run_no: 'PR-2026-0001',
        status: 'draft',
        period_start: '2026-09-01',
        period_end: '2026-09-30',
        scheduled_for: null,
        approved_at: null,
        released_at: null,
        total_paise: 822_000,
        hospital_count: 1,
        notes: null,
        initiated_by_id: 'u-1',
        skipped: [
          {
            hospital_id: 'h-2',
            settlement_period_id: 'p-2',
            net_payable_paise: 10_000,
            reason: 'bank_account_unverified',
          },
        ],
      }),
    );
    expect(created.run.initiatedById).toBe('u-1');
    expect(created.skipped).toEqual([
      {
        hospitalId: 'h-2',
        settlementPeriodId: 'p-2',
        netPayableRupees: 100,
        reason: 'bank_account_unverified',
      },
    ]);
  });
});

describe('statements and adjustments', () => {
  it('names a statement from its hospital snapshot', () => {
    const statement = toPlatformStatement(
      statementResponseSchema.parse({
        id: 's-1',
        hospital_id: 'h-1',
        statement_no: 'STM-2026-0009',
        period_start: '2026-09-01',
        period_end: '2026-09-30',
        issued_at: '2026-10-01T02:00:00Z',
        bookings_count: 40,
        gross_paise: 1_000_000,
        convenience_fees_paise: 30_000,
        convenience_fee_gst_paise: 5_400,
        commission_paise: 100_000,
        commission_gst_paise: 18_000,
        gateway_fees_paise: 20_000,
        refunds_paise: 50_000,
        net_payable_paise: 812_000,
        pdf_file_id: null,
        hospital_snapshot: { name: 'City Care', legal_name: 'City Care Pvt Ltd' },
      }),
    );
    expect(statement).toMatchObject({ hospitalName: 'City Care', netPayableRupees: 8_120 });
  });

  it('sends a signed adjustment in paise', () => {
    expect(
      toAdjustmentCreateRequest({
        hospitalId: 'h-1',
        settlementPeriodId: 'p-1',
        amountRupees: -250.5,
        reason: 'Correction',
      }),
    ).toEqual({
      hospital_id: 'h-1',
      settlement_period_id: 'p-1',
      amount_paise: -25_050,
      reason: 'Correction',
    });
  });
});
