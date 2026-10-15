import { describe, expect, it } from 'vitest';

import type {
  SettlementBreakdown,
  SettlementPeriodDetail,
} from '@/features/settlements/domain/entities/settlements.entities';
import {
  monthLabel,
  PERIOD_STATUS,
  periodCheck,
  statementSpan,
} from '@/features/settlements/presentation/components/settlementsFormat';

const BREAKDOWN: SettlementBreakdown = {
  grossPaise: 100_000,
  refundsPaise: 0,
  gatewayFeesPaise: 2_000,
  commissionPaise: 5_000,
  commissionGstPaise: 900,
  convenienceFeesPaise: 0,
  convenienceFeeGstPaise: 0,
  ledgerNetPaise: 92_100,
  bookingsCount: 4,
  carriedAdjustmentsPaise: 0,
  lateEntries: 0,
  expectedNetPaise: null,
  differencePaise: null,
  reconciled: null,
};

function detail(over: Partial<SettlementPeriodDetail>): SettlementPeriodDetail {
  return {
    id: 'p-1',
    periodStart: '2026-09-01',
    periodEnd: '2026-09-15',
    status: 'closed',
    grossPaise: 100_000,
    refundsPaise: 0,
    gatewayFeesPaise: 2_000,
    commissionPaise: 5_900,
    adjustmentsPaise: 10_000,
    tdsPaise: 0,
    netPayablePaise: 102_100,
    closedAt: '2026-09-16T00:00:00Z',
    breakdown: BREAKDOWN,
    adjustments: [],
    payout: null,
    statements: null,
    ...over,
  };
}

describe('periodCheck', () => {
  it('counts adjustments and TDS into the expected net (SET-01)', () => {
    expect(periodCheck(detail({}))).toEqual({
      expectedNetPaise: 102_100,
      differencePaise: 0,
      reconciled: true,
    });
    expect(periodCheck(detail({ tdsPaise: 1_000 }))).toEqual({
      expectedNetPaise: 101_100,
      differencePaise: 1_000,
      reconciled: false,
    });
  });

  it('takes the server’s own figures when it sends them', () => {
    const check = periodCheck(
      detail({
        breakdown: {
          ...BREAKDOWN,
          expectedNetPaise: 90_000,
          differencePaise: 12_100,
          reconciled: false,
        },
      }),
    );
    expect(check).toEqual({ expectedNetPaise: 90_000, differencePaise: 12_100, reconciled: false });
  });
});

describe('statement labels', () => {
  it('names a whole month by its month', () => {
    expect(monthLabel('2026-09-01')).toBe('September 2026');
    expect(statementSpan({ periodStart: '2026-02-01', periodEnd: '2026-02-28' })).toBe(
      'February 2026',
    );
  });

  it('shows the dates of anything that is not one whole month', () => {
    expect(statementSpan({ periodStart: '2026-09-01', periodEnd: '2026-09-15' })).toBe(
      '01 Sep 2026 – 15 Sep 2026',
    );
  });
});

describe('period status labels', () => {
  it('never call a period "accruing" (decision 11, UAT-63)', () => {
    expect(Object.values(PERIOD_STATUS).map((s) => s.label.toLowerCase())).not.toContain(
      'accruing',
    );
  });
});
