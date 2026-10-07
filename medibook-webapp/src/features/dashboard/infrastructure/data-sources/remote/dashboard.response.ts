import { z } from 'zod';

import type {
  AdminDashboard,
  AppointmentBrief,
  AppointmentBriefList,
  CashDrawerBrief,
  ReceptionDashboard,
} from '@/features/dashboard/domain/entities/dashboard.types';

/**
 * Response DTOs for the two dashboards, following
 * `analytics/services/dashboard.py` (`admin`, `reception`, `_appt_brief`) and
 * `tokens/services/queue.py` (`snapshot`). Fields added by DASH-01/02,
 * BE-20 and BE-26 are optional so the screens work against an older backend.
 */

const PAISE_PER_RUPEE = 100;

function toRupees(paise: number): number {
  return paise / PAISE_PER_RUPEE;
}

/** A grouped `Sum`/`Count`; the group key can be `null` (e.g. a payment with no order). */
const totalsSchema = z.record(z.string(), z.number().nullable());

/** Channel → method → total (DASH-02). */
const nestedTotalsSchema = z.record(z.string(), totalsSchema);

function toRupeeTotals(totals: Readonly<Record<string, number | null>>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(totals).map(([key, paise]) => [key, toRupees(paise ?? 0)]),
  );
}

function toCounts(totals: Readonly<Record<string, number | null>>): Record<string, number> {
  return Object.fromEntries(Object.entries(totals).map(([key, n]) => [key, n ?? 0]));
}

export const adminDashboardResponseSchema = z.object({
  period: z.enum(['today', '7d', '30d', 'mtd']),
  date_from: z.string(),
  date_to: z.string(),
  appointments: z.object({
    total: z.number().int(),
    by_status: totalsSchema,
    by_source: totalsSchema,
    // DASH-01: present when `total` and `by_source` already leave these out.
    no_show: z.number().int().optional(),
    cancelled: z.number().int().optional(),
  }),
  revenue: z.object({
    collected_paise: z.number(),
    refunded_paise: z.number(),
    net_paise: z.number(),
    by_channel: totalsSchema,
    by_method: totalsSchema,
    by_channel_method: nestedTotalsSchema.optional(),
    refunds_by_channel: totalsSchema.optional(),
    refunds_by_method: totalsSchema.optional(),
  }),
  departments: z.array(
    z.object({ department_id: z.string(), name: z.string(), appointments: z.number().int() }),
  ),
  top_doctors: z.array(
    z.object({
      doctor_id: z.string(),
      name: z.string(),
      appointments: z.number().int(),
      completed: z.number().int(),
    }),
  ),
  alerts: z.object({
    pending_approvals: z.number().int(),
    pending_approvals_today: z.number().int().optional(),
    pending_patient_changes: z.number().int(),
    unpaid_walk_ins_today: z.number().int(),
    cash_sessions_to_reconcile: z.number().int(),
  }),
});

export type AdminDashboardResponse = z.infer<typeof adminDashboardResponseSchema>;

const appointmentBriefSchema = z.object({
  id: z.string(),
  booking_ref: z.string(),
  token_label: z.string().nullable(),
  status: z.string(),
  source: z.string(),
  payment_status: z.string(),
  total_paise: z.number(),
  scheduled_date: z.string().optional(),
  scheduled_start_at: z.string(),
  doctor_name: z.string(),
  patient: z.object({ mrn: z.string().nullable(), full_name: z.string() }),
});

const appointmentBriefListSchema = z.object({
  count: z.number().int(),
  items: z.array(appointmentBriefSchema),
});

export const receptionDashboardResponseSchema = z.object({
  date: z.string(),
  sessions: z.array(
    z.object({
      id: z.string(),
      doctor_id: z.string(),
      department_id: z.string().nullable().optional(),
      label: z.string(),
      status: z.string(),
      current_token_no: z.number().int().nullable(),
      current_appointment_id: z.string().nullable().optional(),
      current_token_label: z.string().nullable().optional(),
      waiting_count: z.number().int(),
      completed_count: z.number().int(),
    }),
  ),
  queue_summary: z.object({
    total: z.number().int(),
    waiting: z.number().int(),
    checked_in: z.number().int(),
    in_consultation: z.number().int(),
    completed: z.number().int(),
    no_show: z.number().int(),
    cancelled: z.number().int(),
  }),
  pending_approvals: appointmentBriefListSchema.extend({
    // BE-26: the list is the day's; the rest are only counted.
    other_days_count: z.number().int().optional(),
  }),
  unpaid_walk_ins: appointmentBriefListSchema,
  cash_session: z
    .object({
      id: z.string(),
      business_date: z.string(),
      opened_at: z.string(),
      counter_code: z.string().nullable(),
      opening_float_paise: z.number(),
      expected_cash_paise: z.number(),
    })
    .nullable()
    .optional(),
});

export type ReceptionDashboardResponse = z.infer<typeof receptionDashboardResponseSchema>;

const CANCELLED = 'cancelled';
const NO_SHOW = 'no_show';

export function toAdminDashboard(dto: AdminDashboardResponse): AdminDashboard {
  const byStatus = toCounts(dto.appointments.by_status);
  // DASH-01 backends send `cancelled`/`no_show` beside a live-only total;
  // older ones folded both into `total`, so take them out here.
  const isLiveDefinition = dto.appointments.cancelled !== undefined;
  const cancelled = dto.appointments.cancelled ?? byStatus[CANCELLED] ?? 0;
  const noShow = dto.appointments.no_show ?? byStatus[NO_SHOW] ?? 0;
  const booked = isLiveDefinition
    ? dto.appointments.total
    : Math.max(0, dto.appointments.total - cancelled - noShow);
  const r = dto.revenue;
  return {
    period: dto.period,
    dateFrom: dto.date_from,
    dateTo: dto.date_to,
    appointmentsBooked: booked,
    appointmentsCancelled: cancelled,
    appointmentsNoShow: noShow,
    appointmentsByStatus: byStatus,
    appointmentsBySource: toCounts(dto.appointments.by_source),
    bySourceIsLive: isLiveDefinition,
    collectedRupees: toRupees(r.collected_paise),
    refundedRupees: toRupees(r.refunded_paise),
    netRupees: toRupees(r.net_paise),
    collectedByChannel: toRupeeTotals(r.by_channel),
    collectedByMethod: toRupeeTotals(r.by_method),
    collectedByChannelMethod: r.by_channel_method
      ? Object.fromEntries(
          Object.entries(r.by_channel_method).map(([ch, m]) => [ch, toRupeeTotals(m)]),
        )
      : null,
    refundedByChannel: r.refunds_by_channel ? toRupeeTotals(r.refunds_by_channel) : null,
    refundedByMethod: r.refunds_by_method ? toRupeeTotals(r.refunds_by_method) : null,
    departments: dto.departments.map((d) => ({
      departmentId: d.department_id,
      name: d.name,
      appointments: d.appointments,
    })),
    topDoctors: dto.top_doctors.map((d) => ({
      doctorId: d.doctor_id,
      name: d.name,
      appointments: d.appointments,
      completed: d.completed,
    })),
    alerts: {
      pendingApprovals: dto.alerts.pending_approvals,
      pendingApprovalsToday: dto.alerts.pending_approvals_today ?? null,
      pendingPatientChanges: dto.alerts.pending_patient_changes,
      unpaidWalkInsToday: dto.alerts.unpaid_walk_ins_today,
      cashSessionsToReconcile: dto.alerts.cash_sessions_to_reconcile,
    },
  };
}

function toBrief(dto: z.infer<typeof appointmentBriefSchema>): AppointmentBrief {
  return {
    id: dto.id,
    bookingRef: dto.booking_ref,
    tokenLabel: dto.token_label,
    status: dto.status,
    source: dto.source,
    paymentStatus: dto.payment_status,
    totalRupees: toRupees(dto.total_paise),
    scheduledDate: dto.scheduled_date ?? null,
    scheduledStartAt: dto.scheduled_start_at,
    doctorName: dto.doctor_name,
    patientName: dto.patient.full_name,
  };
}

function toBriefList(dto: z.infer<typeof appointmentBriefListSchema>): AppointmentBriefList {
  return { count: dto.count, items: dto.items.map(toBrief) };
}

function toCashDrawer(
  dto: NonNullable<ReceptionDashboardResponse['cash_session']>,
): CashDrawerBrief {
  return {
    id: dto.id,
    businessDate: dto.business_date,
    openedAt: dto.opened_at,
    counterCode: dto.counter_code,
    openingFloatRupees: toRupees(dto.opening_float_paise),
    expectedCashRupees: toRupees(dto.expected_cash_paise),
  };
}

export function toReceptionDashboard(dto: ReceptionDashboardResponse): ReceptionDashboard {
  const q = dto.queue_summary;
  return {
    date: dto.date,
    sessions: dto.sessions.map((s) => ({
      id: s.id,
      doctorId: s.doctor_id,
      departmentId: s.department_id ?? null,
      label: s.label,
      status: s.status,
      currentAppointmentId: s.current_appointment_id ?? null,
      currentTokenLabel: s.current_token_label ?? null,
      waitingCount: s.waiting_count,
      completedCount: s.completed_count,
    })),
    queueSummary: {
      total: q.total,
      waiting: q.waiting,
      checkedIn: q.checked_in,
      inConsultation: q.in_consultation,
      completed: q.completed,
      noShow: q.no_show,
      cancelled: q.cancelled,
    },
    pendingApprovals: {
      ...toBriefList(dto.pending_approvals),
      otherDaysCount: dto.pending_approvals.other_days_count ?? null,
    },
    unpaidWalkIns: toBriefList(dto.unpaid_walk_ins),
    cashSession: dto.cash_session ? toCashDrawer(dto.cash_session) : null,
  };
}
