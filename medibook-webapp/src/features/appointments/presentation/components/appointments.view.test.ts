import { describe, expect, it } from 'vitest';

import type { Failure } from '@/core/error/failure';

import type { DeskAppointment } from '@/features/appointments/domain/entities/appointments.entities';
import {
  acceptedMethodsOf,
  canCheckIn,
  canMarkNoShow,
  deskErrorText,
  hasTokenSlip,
  isNothingDue,
  isSlotRefusal,
  moneyBackAction,
  needsPayment,
  paymentBadge,
  primaryAction,
  rangeFor,
  reasonCopy,
} from '@/features/appointments/presentation/components/appointments.view';

const TODAY = '2026-10-07';

function appt(over: Partial<DeskAppointment> = {}): DeskAppointment {
  return {
    id: 'a1',
    bookingRef: 'MB-1',
    status: 'scheduled',
    statusReason: null,
    source: 'walk_in',
    patient: null,
    doctor: { id: 'd1', name: 'Dr A', room: null },
    department: { id: 'dep1', name: 'Cardiology' },
    sessionId: 's1',
    sessionLabel: 'Morning',
    sessionStatus: 'open',
    serviceId: null,
    visitId: null,
    scheduledDate: TODAY,
    // 10:30 Kolkata
    scheduledStartAt: '2026-10-07T05:00:00Z',
    scheduledEndAt: '2026-10-07T05:15:00Z',
    tokenLabel: 'W001',
    tokenNo: 1,
    calledAt: null,
    noShowAttempts: 0,
    consultationStartedAt: null,
    isFollowUp: false,
    patientNotes: '',
    remark: '',
    paymentStatus: 'unpaid',
    consultationRupees: 500,
    serviceRupees: 0,
    discountRupees: 0,
    convenienceRupees: 0,
    taxRupees: 0,
    totalRupees: 500,
    approvedAt: null,
    checkedInAt: null,
    completedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    noShowAt: null,
    createdAt: '2026-10-07T04:00:00Z',
    version: 1,
    ...over,
  };
}

function failure(over: Partial<Failure> = {}): Failure {
  return {
    kind: 'conflict',
    message: 'Server says no.',
    code: null,
    status: 409,
    fieldErrors: {},
    requestId: null,
    meta: {},
    ...over,
  };
}

describe('₹0 walk-ins owe nothing (UAT-12)', () => {
  it('reads not_required, or a zero total on an older backend, as nothing due', () => {
    expect(isNothingDue(appt({ paymentStatus: 'not_required', totalRupees: 0 }))).toBe(true);
    expect(isNothingDue(appt({ paymentStatus: 'unpaid', totalRupees: 0 }))).toBe(true);
    expect(isNothingDue(appt({ paymentStatus: 'unpaid', totalRupees: 500 }))).toBe(false);
  });

  it('never asks to collect for a ₹0 walk-in and lets it check in', () => {
    const free = appt({ paymentStatus: 'unpaid', totalRupees: 0 });
    expect(needsPayment(free)).toBe(false);
    expect(canCheckIn(free, TODAY)).toBe(true);
    expect(primaryAction(free, TODAY)?.key).toBe('checkin');
    expect(paymentBadge(free).label).toBe('Nothing due');
  });

  it('keeps an unpaid walk-in out of check-in until it is paid', () => {
    const owing = appt();
    expect(needsPayment(owing)).toBe(true);
    expect(canCheckIn(owing, TODAY)).toBe(false);
    expect(canCheckIn(appt({ paymentStatus: 'paid' }), TODAY)).toBe(true);
    // A prepaid online booking needs no collection.
    expect(canCheckIn(appt({ source: 'online', paymentStatus: 'paid' }), TODAY)).toBe(true);
  });

  it('checks in only on the booking’s own day', () => {
    expect(canCheckIn(appt({ paymentStatus: 'paid', scheduledDate: '2026-10-08' }), TODAY)).toBe(
      false,
    );
  });
});

describe('desk roles that cannot collect (UAT-45)', () => {
  it('offers no Collect to a role without payments', () => {
    expect(primaryAction(appt(), TODAY, true)?.key).toBe('pay');
    expect(primaryAction(appt(), TODAY, false)).toBeNull();
  });
});

describe('no-show only for waiting bookings that are due (UAT-13)', () => {
  const beforeSlot = Date.parse('2026-10-07T04:30:00Z');
  const afterStart = Date.parse('2026-10-07T05:01:00Z');

  it('refuses a booking ahead of its day', () => {
    expect(canMarkNoShow(appt({ scheduledDate: '2026-10-08' }), TODAY, afterStart)).toBe(false);
  });

  it('allows an earlier day (closing out absentees)', () => {
    expect(canMarkNoShow(appt({ scheduledDate: '2026-10-06' }), TODAY, beforeSlot)).toBe(true);
  });

  it('on the day, waits for the slot to start or the token to be called', () => {
    expect(canMarkNoShow(appt(), TODAY, beforeSlot)).toBe(false);
    expect(canMarkNoShow(appt(), TODAY, afterStart)).toBe(true);
    expect(canMarkNoShow(appt({ calledAt: '2026-10-07T04:20:00Z' }), TODAY, beforeSlot)).toBe(true);
  });

  it('never for a booking already in consultation or over', () => {
    for (const status of ['in_consultation', 'completed', 'cancelled', 'no_show'] as const) {
      expect(canMarkNoShow(appt({ status }), TODAY, afterStart)).toBe(false);
    }
  });
});

describe('money back (B3 REFUND_REQUIRES_CANCEL, 03 F16)', () => {
  it('refunds a finished paid booking and cancels-with-refund a live one', () => {
    expect(moneyBackAction(appt({ status: 'completed', paymentStatus: 'paid' }))).toBe('refund');
    expect(moneyBackAction(appt({ status: 'no_show', paymentStatus: 'paid' }))).toBe('refund');
    expect(moneyBackAction(appt({ status: 'scheduled', paymentStatus: 'paid' }))).toBe(
      'cancel-refund',
    );
    expect(moneyBackAction(appt({ status: 'in_consultation', paymentStatus: 'paid' }))).toBeNull();
    expect(moneyBackAction(appt({ status: 'completed', paymentStatus: 'refunded' }))).toBeNull();
    expect(moneyBackAction(appt())).toBeNull();
  });

  it('promises a refund only when something was paid', () => {
    const unpaid = reasonCopy('cancel', appt(), '₹500');
    expect(unpaid.body).toContain('nothing to refund');
    expect(unpaid.confirm).toBe('Cancel booking');
    const paid = reasonCopy('reject', appt({ paymentStatus: 'paid' }), '₹500');
    expect(paid.body).toContain('refunded ₹500 in full');
    expect(paid.confirm).toBe('Reject & refund');
  });
});

describe('desk refusal wording (UAT-18)', () => {
  it('names the slot refusal and the consultation it concerns', () => {
    const taken = failure({ code: 'SLOT_TAKEN', meta: { index: 1 } });
    expect(isSlotRefusal(taken)).toBe(true);
    expect(deskErrorText(taken, 'x')).toMatch(/^Consultation 2: That time was just taken/);
    expect(deskErrorText(failure({ code: 'SLOT_IN_PAST' }), 'x')).toMatch(/already ended/);
    expect(deskErrorText(failure({ code: 'SLOT_CLOSED' }), 'x')).toMatch(/no longer open/);
  });

  it('words the accepted desk methods and the cash drawer rule', () => {
    expect(
      deskErrorText(
        failure({ kind: 'validation', meta: { accepted_methods: ['cash', 'upi'] } }),
        'x',
      ),
    ).toBe('This hospital takes Cash, UPI at the desk.');
    expect(deskErrorText(failure({ code: 'CASH_SESSION_REQUIRED' }), 'x')).toMatch(/cash drawer/);
  });

  it('narrows Collect to the methods the hospital accepts (APPT-03)', () => {
    expect(
      acceptedMethodsOf(failure({ meta: { accepted_methods: ['upi', 'emi', 'cash'] } })),
    ).toEqual(['upi', 'cash']);
    expect(acceptedMethodsOf(failure())).toBeNull();
  });

  it('falls back to the first field message, then the server message', () => {
    expect(
      deskErrorText(
        failure({ kind: 'validation', fieldErrors: { remark: ['Too long.'] } }),
        'fallback',
      ),
    ).toBe('Too long.');
    expect(deskErrorText(failure(), 'fallback')).toBe('Server says no.');
  });
});

describe('token slip', () => {
  it('exists only while the booking holds its token', () => {
    expect(hasTokenSlip(appt())).toBe(true);
    expect(hasTokenSlip(appt({ status: 'cancelled' }))).toBe(false);
    expect(hasTokenSlip(appt({ tokenLabel: null }))).toBe(false);
  });
});

describe('date windows use the hospital day (UAT-47)', () => {
  it('builds each window from the hospital-local today', () => {
    expect(rangeFor('Today', '', TODAY)).toEqual({ dateFrom: TODAY, dateTo: TODAY });
    expect(rangeFor('Tomorrow', '', TODAY)).toEqual({
      dateFrom: '2026-10-08',
      dateTo: '2026-10-08',
    });
    expect(rangeFor('This Week', '', TODAY)).toEqual({
      dateFrom: TODAY,
      dateTo: '2026-10-13',
    });
    expect(rangeFor('Last 7 Days', '', TODAY)).toEqual({
      dateFrom: '2026-09-30',
      dateTo: '2026-10-06',
    });
    expect(rangeFor('Upcoming', '', TODAY).dateFrom).toBe(TODAY);
    expect(rangeFor('Today', '2026-12-01', TODAY)).toEqual({
      dateFrom: '2026-12-01',
      dateTo: '2026-12-01',
    });
  });
});
