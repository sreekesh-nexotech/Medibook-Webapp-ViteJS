import { describe, expect, it } from 'vitest';

import type { SettlementPeriod } from '@/features/settlements/domain/entities/settlements.entities';

import {
  buildHospitalNotifs,
  isBellEntryUnread,
  localBellEntries,
  localReadKey,
  serverBellEntries,
} from './hospitalBell';

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

describe('server bell (DASH-03)', () => {
  const feed = {
    unreadCount: 1,
    items: [
      {
        key: 'settlements_awaiting_payout',
        label: 'Settlements awaiting payout',
        count: 2,
        latestAt: '2026-10-06T10:00:00Z',
        amountPaise: 1_500_000,
        read: false,
        readAt: null,
      },
      {
        key: 'pending_approvals',
        label: 'Bookings awaiting approval',
        count: 3,
        latestAt: '2026-10-07T09:00:00Z',
        amountPaise: null,
        read: true,
        readAt: '2026-10-07T09:30:00Z',
      },
      {
        key: 'something_new',
        label: 'A new kind of alert',
        count: 1,
        latestAt: null,
        amountPaise: null,
        read: false,
        readAt: null,
      },
    ],
  };

  it('maps each item to its screen, money and read state', () => {
    const [payout, approvals, unknown] = serverBellEntries(feed);
    expect(payout.title).toBe('Settlements awaiting payout (2)');
    expect(payout.sub).toContain('expected from medibook');
    expect(payout.go).toBe('settlements');
    expect(approvals.go).toBe('appointments');
    expect(isBellEntryUnread(approvals, new Set())).toBe(false);
    expect(unknown.title).toBe('A new kind of alert (1)');
    expect(unknown.go).toBe('dashboard');
  });

  it('honours a read kept in the browser until a newer row arrives', () => {
    const [payout] = serverBellEntries(feed);
    const seen = new Set([localReadKey(payout)]);
    expect(isBellEntryUnread(payout, seen)).toBe(false);
    const [newer] = serverBellEntries({
      ...feed,
      items: [{ ...feed.items[0], latestAt: '2026-10-07T11:00:00Z' }],
    });
    expect(isBellEntryUnread(newer, seen)).toBe(true);
  });

  it('keys browser-built rows by their text', () => {
    const [entry] = localBellEntries(
      buildHospitalNotifs({ isAdmin: false, canSeeSettlements: false }, ALERTS, []),
    );
    expect(localReadKey(entry)).toBe('2 bookings awaiting approval');
    expect(isBellEntryUnread(entry, new Set(['2 bookings awaiting approval']))).toBe(false);
  });
});
