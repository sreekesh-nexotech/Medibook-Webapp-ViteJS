import { describe, expect, it } from 'vitest';

import type { SettlementPeriod } from '@/features/settlements/domain/entities/settlements.entities';

import { buildHospitalNotifs } from './hospitalBell';

const ALERTS = {
  pendingApprovals: 2,
  pendingPatientChanges: 1,
  unpaidWalkInsToday: 0,
  cashSessionsToReconcile: 3,
};

function period(status: SettlementPeriod['status'], netPayablePaise: number): SettlementPeriod {
  return {
    id: `p-${status}-${netPayablePaise}`,
    periodStart: '2026-09-28',
    periodEnd: '2026-10-04',
    status,
    grossPaise: netPayablePaise,
    refundsPaise: 0,
    gatewayFeesPaise: 0,
    commissionPaise: 0,
    adjustmentsPaise: 0,
    tdsPaise: 0,
    netPayablePaise,
    closedAt: '2026-10-05T00:00:00Z',
  };
}

const PERIODS = [period('closed', 150_000), period('on_hold', 50_000)];

describe('buildHospitalNotifs (UAT-68)', () => {
  it('gives an accountant settlement alerts by permission, without admin-only items', () => {
    const titles = buildHospitalNotifs(
      { isAdmin: false, canSeeSettlements: true },
      ALERTS,
      PERIODS,
    ).map((n) => n.t);
    expect(titles).toEqual([
      '2 bookings awaiting approval',
      '1 settlement on hold',
      '1 settlement awaiting payout',
    ]);
  });

  it('hides settlements from a role without Billing & Settlements view', () => {
    const titles = buildHospitalNotifs(
      { isAdmin: false, canSeeSettlements: false },
      ALERTS,
      PERIODS,
    ).map((n) => n.t);
    expect(titles).toEqual(['2 bookings awaiting approval']);
  });

  it('gives admins patient changes and drawers to reconcile', () => {
    const titles = buildHospitalNotifs({ isAdmin: true, canSeeSettlements: true }, ALERTS, []).map(
      (n) => n.t,
    );
    expect(titles).toEqual([
      '2 bookings awaiting approval',
      '1 patient change to review',
      '3 cash sessions to reconcile',
    ]);
  });
});
