import { describe, expect, it } from 'vitest';

import { monthStartOf } from '@/features/settlements/infrastructure/data-sources/remote/settlements.api';
import {
  creditNotePageResponseSchema,
  toCreditNote,
} from '@/features/settlements/infrastructure/data-sources/remote/billing.response';
import {
  payoutPageResponseSchema,
  settlementPeriodDetailResponseSchema,
  toPayout,
  toSettlementPeriodDetail,
} from '@/features/settlements/infrastructure/data-sources/remote/settlements.response';
import detailFixture from '@/test/contract/fixtures/settlements.settlementPeriodDetailResponseSchema.json';

const PAYOUT = detailFixture.payout;

/** The same period as the B4 backend sends it: statements linked, the net checked. */
const B4_DETAIL = {
  ...detailFixture,
  period_start: '2026-08-25',
  period_end: '2026-09-07',
  statement_id: 'st-sep',
  statement_no: 'STM-26-27-0004',
  statements: [
    {
      id: 'st-aug',
      statement_no: 'STM-26-27-0001',
      period_start: '2026-08-01',
      period_end: '2026-08-31',
      issued_at: '2026-09-29T17:21:33Z',
    },
    {
      id: 'st-sep',
      statement_no: 'STM-26-27-0004',
      period_start: '2026-09-01',
      period_end: '2026-09-30',
      issued_at: '2026-09-30T20:30:00Z',
    },
  ],
  breakdown: {
    ...detailFixture.breakdown,
    carried_adjustments_paise: -5000,
    late_entries: 2,
    adjustments_paise: 10000,
    tds_paise: 0,
    expected_net_paise: 1574247,
    difference_paise: -10000,
    reconciled: false,
  },
  adjustments: [
    {
      id: 'adj-1',
      hospital_id: detailFixture.hospital_id,
      settlement_period_id: detailFixture.id,
      amount_paise: 10000,
      reason: 'Goodwill',
      created_by_id: 'u-1',
      carried_forward: true,
      created_at: '2026-10-01T10:00:00Z',
    },
  ],
};

describe('settlement period detail', () => {
  it('reads today’s backend: no statement links, the check left to the client', () => {
    const detail = toSettlementPeriodDetail(
      settlementPeriodDetailResponseSchema.parse(detailFixture),
    );
    expect(detail.statements).toBeNull();
    expect(detail.breakdown.expectedNetPaise).toBeNull();
    expect(detail.breakdown.reconciled).toBeNull();
    expect(detail.breakdown.carriedAdjustmentsPaise).toBe(0);
    expect(detail.payout?.periodStart).toBe('2026-09-01');
    expect(detail.payout?.createdAt).toBe(PAYOUT.created_at);
  });

  it('puts the statement the server names (the month of the period start) first', () => {
    const detail = toSettlementPeriodDetail(settlementPeriodDetailResponseSchema.parse(B4_DETAIL));
    expect(detail.statements?.map((s) => s.id)).toEqual(['st-sep', 'st-aug']);
    expect(detail.statements?.[0]?.statementNo).toBe('STM-26-27-0004');
  });

  it('carries the server’s own reconciliation and carried-forward adjustments', () => {
    const detail = toSettlementPeriodDetail(settlementPeriodDetailResponseSchema.parse(B4_DETAIL));
    expect(detail.breakdown).toMatchObject({
      carriedAdjustmentsPaise: -5000,
      lateEntries: 2,
      expectedNetPaise: 1574247,
      differencePaise: -10000,
      reconciled: false,
    });
    expect(detail.adjustments[0]?.carriedForward).toBe(true);
  });

  it('keeps the server’s order when it names no statement', () => {
    const detail = toSettlementPeriodDetail(
      settlementPeriodDetailResponseSchema.parse({ ...B4_DETAIL, statement_id: null }),
    );
    expect(detail.statements?.map((s) => s.id)).toEqual(['st-aug', 'st-sep']);
  });
});

describe('payout list', () => {
  it('reads the hospital payout rows', () => {
    const page = payoutPageResponseSchema.parse({
      results: [PAYOUT],
      page: 1,
      page_size: 12,
      total: 1,
      has_next: false,
    });
    const payout = page.results[0];
    if (!payout) throw new Error('expected a row');
    expect(toPayout(payout)).toMatchObject({
      settlementPeriodId: detailFixture.id,
      periodEnd: '2026-09-15',
      status: 'pending',
      bankAccountLast4: '0000',
    });
  });
});

describe('credit notes', () => {
  it('works out what is left when the row does not say', () => {
    const page = creditNotePageResponseSchema.parse({
      results: [
        {
          id: 'cn-1',
          credit_note_no: 'CN-26-27-0001',
          hospital_id: 'h-1',
          issued_at: '2026-10-01T10:00:00Z',
          reason: '',
          subtotal_paise: 100000,
          gst_paise: 18000,
          total_paise: 118000,
          applied_paise: 18000,
          lines: [],
        },
      ],
      page: 1,
      page_size: 100,
      total: 1,
      has_next: false,
    });
    const row = page.results[0];
    if (!row) throw new Error('expected a row');
    expect(toCreditNote(row)).toMatchObject({
      creditNoteNo: 'CN-26-27-0001',
      reason: null,
      remainingPaise: 100000,
    });
  });
});

describe('monthStartOf', () => {
  it('moves a date to the 1st of its month', () => {
    expect(monthStartOf('2026-09-16')).toBe('2026-09-01');
    expect(monthStartOf('2026-09-01')).toBe('2026-09-01');
  });
});
