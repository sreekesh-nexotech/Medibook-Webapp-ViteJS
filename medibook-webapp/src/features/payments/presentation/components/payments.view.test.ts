import { describe, expect, it, vi } from 'vitest';

import type {
  CashSummaryRow,
  PaymentLine,
  PaymentRefund,
} from '@/features/payments/domain/entities/payments.entities';
import {
  drawerBalance,
  lineRefundOf,
  orderRefundTotal,
  paiseToRupees,
  rangeForWindow,
  refundAvailability,
  refundFailureCopy,
  rupeesToPaise,
  summaryVariance,
} from '@/features/payments/presentation/components/payments.view';
import { todayISO } from '@/shared/lib/format';
import { todayIn } from '@/shared/lib/hospitalTime';
import { HOSPITAL_DATE, HOSPITAL_TIME_ZONE, PC_DATE, withPcBehindHospital } from '@/test/pcClock';

describe('rupeesToPaise', () => {
  it('reads what the front desk types as whole paise', () => {
    expect(rupeesToPaise('500')).toBe(50000);
    expect(rupeesToPaise('0')).toBe(0);
    expect(rupeesToPaise('1,250.75')).toBe(125075);
    expect(rupeesToPaise('0.10')).toBe(10);
  });

  it('refuses amounts the drawer cannot hold', () => {
    expect(rupeesToPaise('12.345')).toBeNull();
    expect(rupeesToPaise('-500')).toBeNull();
    expect(rupeesToPaise('five hundred')).toBeNull();
  });
});

describe('paiseToRupees', () => {
  it('converts paise back to rupees for display', () => {
    expect(paiseToRupees(95000)).toBe(950);
    expect(paiseToRupees(50)).toBe(0.5);
  });
});

describe('drawerBalance', () => {
  it('compares the counted cash with what the server expected', () => {
    expect(drawerBalance(0)).toBe('balanced');
    expect(drawerBalance(-5000)).toBe('short');
    expect(drawerBalance(100)).toBe('over');
  });
});

describe('refundAvailability (UAT-10, UAT-41)', () => {
  const captured: PaymentLine = {
    id: 'pay-1',
    orderId: 'ord-1',
    appointmentId: 'appt-1',
    visitId: null,
    channel: 'desk',
    method: 'cash',
    amountRupees: 500,
    status: 'captured',
    capturedAt: '2026-10-07T05:00:00Z',
    referenceNote: null,
    gatewayPaymentId: null,
    collectedByName: 'Vineeth Kumar',
    counterCode: 'C1',
    cashSessionId: 'cs-1',
    bookingRefs: ['LKSB-2610-00211'],
    patient: null,
    doctorName: null,
    departmentName: null,
    bookingStatus: null,
    receiptNo: null,
    latestRefund: null,
    createdAt: '2026-10-07T05:00:00Z',
  };

  it('offers a refund only once the booking is over', () => {
    expect(refundAvailability(captured, 'completed', null)).toEqual({
      kind: 'available',
      retry: false,
    });
    expect(refundAvailability(captured, 'cancelled', null).kind).toBe('available');
    expect(refundAvailability(captured, 'no_show', null).kind).toBe('available');
    expect(refundAvailability(captured, 'scheduled', null)).toEqual({
      kind: 'live',
      status: 'scheduled',
    });
    expect(refundAvailability(captured, 'checked_in', null).kind).toBe('live');
  });

  it('leaves it to the server when the booking status is unknown', () => {
    expect(refundAvailability(captured, null, null).kind).toBe('available');
  });

  it('never offers a second refund while one is with the gateway', () => {
    const processing = {
      id: 'r-1',
      status: 'processing' as const,
      amountRupees: 500,
      failureReason: null,
    };
    expect(refundAvailability(captured, 'cancelled', processing)).toEqual({ kind: 'processing' });
    const requested = { ...processing, status: 'requested' as const };
    expect(refundAvailability(captured, 'cancelled', requested).kind).toBe('processing');
  });

  it('offers a retry after a failed refund, and nothing once refunded', () => {
    const failed = { id: 'r-1', status: 'failed' as const, amountRupees: 500, failureReason: 'x' };
    expect(refundAvailability(captured, 'cancelled', failed)).toEqual({
      kind: 'available',
      retry: true,
    });
    expect(refundAvailability({ ...captured, status: 'refunded' }, 'cancelled', null).kind).toBe(
      'refunded',
    );
    expect(
      refundAvailability({ ...captured, appointmentId: null, visitId: 'v-1' }, null, null).kind,
    ).toBe('none');
  });

  it('reads the line’s refund state from the row, or from its fetched detail', () => {
    expect(lineRefundOf(captured, undefined)).toBeNull();
    const unknown = { ...captured, latestRefund: undefined };
    expect(lineRefundOf(unknown, undefined)).toBeUndefined();
    const refund: PaymentRefund = {
      id: 'r-2',
      paymentId: 'pay-1',
      appointmentId: 'appt-1',
      bookingRef: 'LKSB-2610-00211',
      amountRupees: 500,
      method: 'upi',
      status: 'processing',
      reason: 'Doctor unavailable',
      requestedAt: '2026-10-07T06:00:00Z',
      processedAt: null,
      failureReason: null,
      cashSessionId: null,
      channel: 'online',
    };
    expect(lineRefundOf(unknown, [{ ...refund, id: 'r-1', status: 'superseded' }, refund])).toEqual(
      { id: 'r-2', status: 'processing', amountRupees: 500, failureReason: null },
    );
    expect(lineRefundOf(unknown, [])).toBeNull();
  });

  it('adds up what a refund of the order hands back', () => {
    expect(
      orderRefundTotal([
        captured,
        { ...captured, id: 'pay-2', method: 'upi', amountRupees: 300 },
        { ...captured, id: 'pay-3', status: 'refunded', amountRupees: 100 },
      ]),
    ).toBe(800);
  });
});

describe('refundFailureCopy', () => {
  const failure = (code: string, message = 'Server says no.') => ({
    kind: 'conflict' as const,
    message,
    code,
    status: 409,
    fieldErrors: {},
    requestId: null,
    meta: {},
  });

  it('points a live booking to cancel, and cash to the drawer the role can open', () => {
    expect(refundFailureCopy(failure('REFUND_REQUIRES_CANCEL'), true)).toMatch(/Cancel it/);
    expect(refundFailureCopy(failure('CASH_SESSION_REQUIRED'), true)).toMatch(
      /Open your cash drawer/,
    );
    expect(refundFailureCopy(failure('CASH_SESSION_REQUIRED'), false)).toMatch(/cannot open one/);
    expect(refundFailureCopy(failure('OTHER', 'Exact words.'), true)).toBe('Exact words.');
  });
});

describe('summaryVariance', () => {
  const row: CashSummaryRow = {
    staffId: 's-1',
    staffName: 'Vineeth Kumar',
    counters: ['C1'],
    openSessions: 1,
    openingFloatPaise: 100000,
    cashInPaise: 50000,
    cashRefundsPaise: 0,
    expectedCashPaise: 150000,
    countedCashPaise: 49000,
    countedExpectedPaise: 50000,
    variancePaise: -1000,
    uncountedSessions: 1,
    drawers: [],
  };

  it('compares counted cash with what the counted drawers should hold (F25)', () => {
    expect(summaryVariance(row)).toBe(-1000);
    expect(summaryVariance({ ...row, countedExpectedPaise: null })).toBe(-1000);
    expect(summaryVariance({ ...row, countedCashPaise: null })).toBeNull();
  });
});

describe('rangeForWindow', () => {
  it('uses the custom range, defaulting to today', () => {
    expect(
      rangeForWindow('Custom range', '2026-10-08', {
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
      }),
    ).toEqual({ dateFrom: '2026-09-01', dateTo: '2026-09-30' });
    expect(rangeForWindow('Custom range', '2026-10-08')).toEqual(
      rangeForWindow('Today', '2026-10-08'),
    );
  });

  it('ends each preset on the given day', () => {
    expect(rangeForWindow('This Week', '2026-10-02')).toEqual({
      dateFrom: '2026-09-26',
      dateTo: '2026-10-02',
    });
    expect(rangeForWindow('This Month', '2026-10-02')).toEqual({
      dateFrom: '2026-10-01',
      dateTo: '2026-10-02',
    });
  });
});

describe('payment presets follow the hospital’s today (UAT-47)', () => {
  withPcBehindHospital();

  it('reads Today, This Week and This Month on the hospital’s calendar, not the PC’s', () => {
    expect(todayISO()).toBe(PC_DATE);
    const today = todayIn(HOSPITAL_TIME_ZONE, Date.now());
    expect(rangeForWindow('Today', today)).toEqual({
      dateFrom: HOSPITAL_DATE,
      dateTo: HOSPITAL_DATE,
    });
    expect(rangeForWindow('This Week', today)).toEqual({
      dateFrom: '2026-10-02',
      dateTo: HOSPITAL_DATE,
    });
    expect(rangeForWindow('This Month', today).dateTo).toBe(HOSPITAL_DATE);
  });

  it('rolls the month over with the hospital: 1 Nov there is still 31 Oct on the PC', () => {
    vi.setSystemTime(Date.UTC(2026, 9, 31, 20, 0));
    expect(todayISO()).toBe('2026-10-31');
    expect(rangeForWindow('This Month', todayIn(HOSPITAL_TIME_ZONE, Date.now()))).toEqual({
      dateFrom: '2026-11-01',
      dateTo: '2026-11-01',
    });
  });
});
