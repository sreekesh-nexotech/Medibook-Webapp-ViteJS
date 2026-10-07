import { describe, expect, it } from 'vitest';

import type { DeskAppointment } from '@/features/appointments/domain/entities/appointments.entities';
import type {
  QueueSession,
  TokenCall,
} from '@/features/token-queue/domain/entities/tokenQueue.entities';
import {
  callNextState,
  callTokenLabel,
  canOfferNoShow,
  closeSessionCopy,
  isServing,
  servingLabel,
  servingSince,
  servingTokenNo,
  skippedFor,
  upNextFor,
} from '@/features/token-queue/presentation/components/tokenQueue.view';

const TODAY = '2026-10-07';

function session(over: Partial<QueueSession> = {}): QueueSession {
  return {
    id: 's1',
    doctorId: 'd1',
    departmentId: null,
    date: TODAY,
    sessionCode: 'morning',
    label: 'Morning',
    status: 'open',
    queueState: 'available',
    currentTokenNo: null,
    currentAppointmentId: null,
    currentTokenLabel: null,
    consultationStartedAt: null,
    expectedMinutes: null,
    lastCalledTokenNo: null,
    lastCalledAt: null,
    servedCount: 0,
    waitingCount: 0,
    completedCount: 0,
    noShowCount: 0,
    version: 1,
    ...over,
  };
}

function appt(tokenNo: number, over: Partial<DeskAppointment> = {}): DeskAppointment {
  return {
    id: `a${tokenNo}`,
    bookingRef: `B${tokenNo}`,
    status: 'scheduled',
    statusReason: null,
    source: 'walk_in',
    patient: null,
    doctor: { id: 'd1', name: 'Dr A', room: null },
    department: { id: 'dep', name: 'Gen' },
    sessionId: 's1',
    sessionLabel: 'Morning',
    sessionStatus: 'open',
    serviceId: null,
    visitId: null,
    scheduledDate: TODAY,
    scheduledStartAt: '2026-10-07T04:00:00Z',
    scheduledEndAt: '2026-10-07T04:15:00Z',
    tokenLabel: `W${String(tokenNo).padStart(3, '0')}`,
    tokenNo,
    calledAt: null,
    noShowAttempts: 0,
    consultationStartedAt: null,
    isFollowUp: false,
    patientNotes: '',
    remark: '',
    paymentStatus: 'paid',
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
    createdAt: '2026-10-07T03:00:00Z',
    version: 1,
    ...over,
  };
}

describe('serving state comes from current_appointment_id (UAT-01)', () => {
  it('is free after Done even though current_token_no stays set', () => {
    // The backend never clears current_token_no; after Done only the appointment id is cleared.
    const afterDone = session({
      currentTokenNo: 3,
      currentAppointmentId: null,
      lastCalledTokenNo: 3,
    });
    expect(isServing(afterDone)).toBe(false);
    expect(servingTokenNo(afterDone)).toBeNull();
    expect(servingLabel(afterDone, null)).toBeNull();
  });

  it('serves the called token while its appointment is current', () => {
    const called = session({
      currentTokenNo: 4,
      currentAppointmentId: 'a4',
      queueState: 'waiting',
    });
    expect(isServing(called)).toBe(true);
    expect(servingTokenNo(called)).toBe(4);
  });

  it('never offers a skipped token to Done: after Skip there is no desk token', () => {
    const afterSkip = session({ currentTokenNo: 5, currentAppointmentId: null });
    expect(servingTokenNo(afterSkip)).toBeNull();
  });

  it('labels the desk token with the backend label, then the booking, never an invented format', () => {
    const s = session({ currentTokenNo: 4, currentAppointmentId: 'a4' });
    expect(servingLabel({ ...s, currentTokenLabel: 'A004' }, appt(4))).toBe('A004');
    expect(servingLabel(s, appt(4))).toBe('W004');
    expect(servingLabel(s, null)).toBe('#4');
  });

  it('times a consultation from its start, a call from the call', () => {
    const s = session({
      currentTokenNo: 4,
      currentAppointmentId: 'a4',
      lastCalledAt: '2026-10-07T04:00:00Z',
    });
    expect(servingSince(s, null)).toBe('2026-10-07T04:00:00Z');
    const consulting = { ...s, queueState: 'consulting' as const };
    expect(
      servingSince(consulting, appt(4, { consultationStartedAt: '2026-10-07T04:05:00Z' })),
    ).toBe('2026-10-07T04:05:00Z');
    expect(
      servingSince({ ...consulting, consultationStartedAt: '2026-10-07T04:06:00Z' }, null),
    ).toBe('2026-10-07T04:06:00Z');
  });
});

describe('up next follows the server call order (UAT-46)', () => {
  const list = [appt(1), appt(2), appt(5), appt(7)];

  it('starts after the last called token and wraps round to the smallest', () => {
    const s = session({ lastCalledTokenNo: 2 });
    const called = list.map((a) => (a.tokenNo === 2 ? { ...a, status: 'completed' as const } : a));
    expect(upNextFor(s, called).map((a) => a.tokenNo)).toEqual([5, 7, 1]);
  });

  it('leaves out cancelled, called and other sessions’ tokens', () => {
    const s = session();
    const rows = [
      appt(1, { status: 'cancelled' }),
      appt(2, { calledAt: '2026-10-07T04:00:00Z' }),
      appt(3, { sessionId: 'other' }),
      appt(4),
    ];
    expect(upNextFor(s, rows).map((a) => a.tokenNo)).toEqual([4]);
    expect(skippedFor(s, rows).map((a) => a.tokenNo)).toEqual([2]);
  });

  it('keeps the desk token out of both lists', () => {
    const s = session({ currentTokenNo: 2, currentAppointmentId: 'a2' });
    const rows = [appt(2, { calledAt: '2026-10-07T04:00:00Z' }), appt(3)];
    expect(skippedFor(s, rows)).toEqual([]);
    expect(upNextFor(s, rows).map((a) => a.tokenNo)).toEqual([3]);
  });
});

describe('Call Next availability (UAT-46)', () => {
  it('is ready when the desk is free and an un-called token waits', () => {
    expect(callNextState(session(), 2, 0).kind).toBe('ready');
  });

  it('points at Skipped when only skipped tokens remain', () => {
    const state = callNextState(session(), 0, 2);
    expect(state.kind).toBe('blocked');
    expect(state.kind === 'blocked' && state.reason).toMatch(/Skipped/);
  });

  it('waits for the desk token to finish and for the session to be open', () => {
    expect(
      callNextState(session({ currentTokenNo: 1, currentAppointmentId: 'a1' }), 3, 0).kind,
    ).toBe('blocked');
    expect(callNextState(session({ status: 'paused' }), 3, 0).kind).toBe('blocked');
    expect(callNextState(session({ status: 'closed' }), 3, 0).kind).toBe('blocked');
  });
});

describe('no-show and close rules', () => {
  it('offers a no-show only for a called token in today’s live session (UAT-13)', () => {
    expect(canOfferNoShow(session(), TODAY, true)).toBe(true);
    expect(canOfferNoShow(session(), TODAY, false)).toBe(false);
    expect(canOfferNoShow(session({ date: '2026-10-06' }), TODAY, true)).toBe(false);
    expect(canOfferNoShow(session({ status: 'closed' }), TODAY, true)).toBe(false);
  });

  it('says how many patients are still waiting when closing', () => {
    expect(closeSessionCopy('Dr A', 'Morning', 0)).not.toMatch(/waiting/);
    expect(closeSessionCopy('Dr A', 'Morning', 1)).toMatch(/1 patient is still waiting/);
    expect(closeSessionCopy('Dr A', 'Morning', 3)).toMatch(/3 patients are still waiting/);
  });
});

describe('call history labels', () => {
  const call: TokenCall = {
    id: 'c1',
    appointmentId: 'a4',
    tokenNo: 4,
    tokenLabel: null,
    event: 'skipped',
    attemptNo: 2,
    actorName: null,
    counterCode: null,
    occurredAt: '2026-10-07T04:00:00Z',
  };

  it('names the token from the call, the booking, or its number', () => {
    const byId = new Map([['a4', appt(4)]]);
    expect(callTokenLabel({ ...call, tokenLabel: 'A004' }, byId)).toBe('A004');
    expect(callTokenLabel(call, byId)).toBe('W004');
    expect(callTokenLabel(call, new Map())).toBe('#4');
  });
});
