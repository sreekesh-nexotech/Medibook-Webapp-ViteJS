import { z } from 'zod';

import type {
  AdminDashboard,
  AppointmentBrief,
  AppointmentBriefList,
  ReceptionDashboard,
} from '@/features/dashboard/domain/entities/dashboard.types';

/**
 * Response DTOs for the two dashboards. `schema.yml` types both as a bare
 * object, so the shapes here follow `analytics/services/dashboard.py`
 * (`admin`, `reception`, `_appt_brief`) and `tokens/services/queue.py`
 * (`snapshot`).
 */

const PAISE_PER_RUPEE = 100;

function toRupees(paise: number): number {
  return paise / PAISE_PER_RUPEE;
}

/** A grouped `Sum`/`Count`; the group key can be `null` (e.g. a payment with no order). */
const totalsSchema = z.record(z.string(), z.number().nullable());

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
  }),
  revenue: z.object({
    collected_paise: z.number(),
    refunded_paise: z.number(),
    net_paise: z.number(),
    by_channel: totalsSchema,
    by_method: totalsSchema,
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
      label: z.string(),
      status: z.string(),
      current_token_no: z.number().int().nullable(),
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
  pending_approvals: appointmentBriefListSchema,
  unpaid_walk_ins: appointmentBriefListSchema,
});

export type ReceptionDashboardResponse = z.infer<typeof receptionDashboardResponseSchema>;

export function toAdminDashboard(dto: AdminDashboardResponse): AdminDashboard {
  return {
    period: dto.period,
    dateFrom: dto.date_from,
    dateTo: dto.date_to,
    appointmentsTotal: dto.appointments.total,
    appointmentsByStatus: toCounts(dto.appointments.by_status),
    appointmentsBySource: toCounts(dto.appointments.by_source),
    collectedRupees: toRupees(dto.revenue.collected_paise),
    refundedRupees: toRupees(dto.revenue.refunded_paise),
    netRupees: toRupees(dto.revenue.net_paise),
    collectedByChannel: toRupeeTotals(dto.revenue.by_channel),
    collectedByMethod: toRupeeTotals(dto.revenue.by_method),
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
    scheduledStartAt: dto.scheduled_start_at,
    doctorName: dto.doctor_name,
    patientName: dto.patient.full_name,
  };
}

function toBriefList(dto: z.infer<typeof appointmentBriefListSchema>): AppointmentBriefList {
  return { count: dto.count, items: dto.items.map(toBrief) };
}

export function toReceptionDashboard(dto: ReceptionDashboardResponse): ReceptionDashboard {
  const q = dto.queue_summary;
  return {
    date: dto.date,
    sessions: dto.sessions.map((s) => ({
      id: s.id,
      doctorId: s.doctor_id,
      label: s.label,
      status: s.status,
      currentTokenNo: s.current_token_no,
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
    pendingApprovals: toBriefList(dto.pending_approvals),
    unpaidWalkIns: toBriefList(dto.unpaid_walk_ins),
  };
}
