import { describe, expect, it } from 'vitest';

import type {
  AppointmentBrief,
  QueueSession,
} from '@/features/dashboard/domain/entities/dashboard.types';
import {
  adminDashboardResponseSchema,
  receptionDashboardResponseSchema,
  toAdminDashboard,
  toReceptionDashboard,
} from '@/features/dashboard/infrastructure/data-sources/remote/dashboard.response';
import {
  actionWhen,
  briefDay,
  departmentQueueRows,
  isSessionServing,
  revenueByChannel,
  revenueByMethod,
} from '@/features/dashboard/presentation/components/dashboard.viewModel';

const KOLKATA = 'Asia/Kolkata';

function session(over: Partial<QueueSession> = {}): QueueSession {
  return {
    id: 's1',
    doctorId: 'd1',
    departmentId: null,
    label: 'Morning',
    status: 'open',
    currentAppointmentId: null,
    currentTokenLabel: null,
    waitingCount: 0,
    completedCount: 0,
    ...over,
  };
}

const ADMIN_BASE = {
  period: 'today',
  date_from: '2026-10-07',
  date_to: '2026-10-07',
  departments: [],
  top_doctors: [],
  alerts: {
    pending_approvals: 3,
    pending_patient_changes: 0,
    unpaid_walk_ins_today: 1,
    cash_sessions_to_reconcile: 0,
  },
};

describe('now serving (UAT-61)', () => {
  it('reads current_appointment_id, not the never-cleared token pointer', () => {
    expect(isSessionServing(session({ currentAppointmentId: 'a1' }))).toBe(true);
    expect(isSessionServing(session())).toBe(false);
    // A closed session never counts, even with a stale current appointment.
    expect(isSessionServing(session({ status: 'closed', currentAppointmentId: 'a1' }))).toBe(false);
  });

  it('parses an older snapshot without current_appointment_id as nobody at the desk', () => {
    const dto = receptionDashboardResponseSchema.parse({
      date: '2026-10-07',
      sessions: [
        {
          id: 's1',
          doctor_id: 'd1',
          label: 'Morning',
          status: 'open',
          current_token_no: 4,
          waiting_count: 2,
          completed_count: 3,
        },
      ],
      queue_summary: {
        total: 5,
        waiting: 2,
        checked_in: 1,
        in_consultation: 0,
        completed: 3,
        no_show: 0,
        cancelled: 0,
      },
      pending_approvals: { count: 0, items: [] },
      unpaid_walk_ins: { count: 0, items: [] },
    });
    const data = toReceptionDashboard(dto);
    expect(isSessionServing(data.sessions[0])).toBe(false);
    expect(data.cashSession).toBeNull();
    expect(data.pendingApprovals.otherDaysCount).toBeNull();
  });

  it('groups department rows by the snapshot department or the roster, with real labels only', () => {
    const departments = [
      { id: 'cardio', name: 'Cardiology', isActive: true },
      { id: 'ortho', name: 'Orthopaedics', isActive: true },
      { id: 'old', name: 'Closed dept', isActive: false },
    ];
    const rows = departmentQueueRows(
      departments,
      [
        session({
          id: 's1',
          doctorId: 'd1',
          waitingCount: 2,
          currentAppointmentId: 'a',
          currentTokenLabel: 'W007',
        }),
        session({
          id: 's2',
          doctorId: 'd9',
          departmentId: 'ortho',
          waitingCount: 1,
          currentAppointmentId: 'b',
        }),
      ],
      new Map([['d1', 'cardio']]),
    );
    expect(rows).toEqual([
      { id: 'cardio', name: 'Cardiology', waiting: 2, isServing: true, servingLabel: 'W007' },
      { id: 'ortho', name: 'Orthopaedics', waiting: 1, isServing: true, servingLabel: null },
    ]);
  });
});

describe('needs-action rows show their day (UAT-62, BE-26)', () => {
  const brief: AppointmentBrief = {
    id: 'a1',
    bookingRef: 'B1',
    tokenLabel: null,
    status: 'pending_approval',
    source: 'online',
    paymentStatus: 'paid',
    totalRupees: 500,
    scheduledDate: null,
    scheduledStartAt: '2026-10-14T05:00:00Z',
    doctorName: 'Dr A',
    patientName: 'P',
  };

  it('reads the day off the start time in the hospital zone when the backend does not send it', () => {
    expect(briefDay(brief, KOLKATA)).toBe('2026-10-14');
    expect(briefDay({ ...brief, scheduledDate: '2026-10-15' }, KOLKATA)).toBe('2026-10-15');
  });

  it('prints only the time for today and the day too for any other day', () => {
    expect(actionWhen(brief, '2026-10-14', KOLKATA)).toMatch(/^10:30\s?am$/i);
    expect(actionWhen(brief, '2026-10-07', KOLKATA)).toMatch(/Wed, 14 Oct · 10:30/);
  });
});

describe('admin figures on both backend versions (DASH-01, DASH-02)', () => {
  it('takes cancellations and no-shows out of an older total', () => {
    const data = toAdminDashboard(
      adminDashboardResponseSchema.parse({
        ...ADMIN_BASE,
        appointments: {
          total: 10,
          by_status: { scheduled: 6, completed: 1, cancelled: 2, no_show: 1 },
          by_source: { online: 6, walk_in: 4 },
        },
        revenue: {
          collected_paise: 100000,
          refunded_paise: 10000,
          net_paise: 90000,
          by_channel: { online: 60000, desk: 40000 },
          by_method: { upi: 70000, cash: 30000 },
        },
      }),
    );
    expect(data.appointmentsBooked).toBe(7);
    expect(data.appointmentsCancelled).toBe(2);
    expect(data.appointmentsNoShow).toBe(1);
    expect(data.bySourceIsLive).toBe(false);
    expect(data.refundedByChannel).toBeNull();
    expect(data.alerts.pendingApprovalsToday).toBeNull();
    const channels = revenueByChannel(data);
    expect(channels.map((r) => [r.key, r.collected, r.refunded])).toEqual([
      ['online', 600, null],
      ['desk', 400, null],
    ]);
  });

  it('uses a live-only total as sent and splits refunds by channel and method', () => {
    const data = toAdminDashboard(
      adminDashboardResponseSchema.parse({
        ...ADMIN_BASE,
        alerts: { ...ADMIN_BASE.alerts, pending_approvals_today: 1 },
        appointments: {
          total: 7,
          by_status: { scheduled: 6, completed: 1, cancelled: 2, no_show: 1 },
          by_source: { online: 4, walk_in: 3 },
          cancelled: 2,
          no_show: 1,
        },
        revenue: {
          collected_paise: 100000,
          refunded_paise: 10000,
          net_paise: 90000,
          by_channel: { online: 60000, desk: 40000 },
          by_method: { upi: 70000, cash: 30000 },
          refunds_by_channel: { desk: 10000 },
          refunds_by_method: { cash: 10000 },
        },
      }),
    );
    expect(data.appointmentsBooked).toBe(7);
    expect(data.bySourceIsLive).toBe(true);
    expect(data.alerts.pendingApprovalsToday).toBe(1);
    expect(revenueByChannel(data).find((r) => r.key === 'desk')).toMatchObject({
      collected: 400,
      refunded: 100,
      net: 300,
    });
    expect(revenueByMethod(data).map((r) => [r.key, r.net])).toEqual([
      ['upi', 700],
      ['cash', 200],
    ]);
  });
});
