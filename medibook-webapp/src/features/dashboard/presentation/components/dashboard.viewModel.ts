import type { BarChartDatum } from '@/shared/ui/BarChart';
import { formatInstant } from '@/shared/lib/format';

import type {
  AppointmentBrief,
  ReceptionDashboard,
} from '@/features/dashboard/domain/entities/dashboard.types';
import type { DoctorStatus } from '@/features/doctors/domain/entities/doctors.types';

/**
 * Pure adapters from the dashboard entities to what the two screens render.
 * Colours are `@theme` tokens, applied per bar through the chart's data.
 */

/** Appointment statuses in lifecycle order, with chart label and bar colour. */
const STATUS_BARS: readonly { code: string; label: string; color: string }[] = [
  { code: 'pending_approval', label: 'Awaiting', color: 'var(--color-y-500)' },
  { code: 'scheduled', label: 'Scheduled', color: 'var(--color-blue)' },
  { code: 'checked_in', label: 'Checked in', color: 'var(--color-p-400)' },
  { code: 'in_consultation', label: 'In consult', color: 'var(--color-blue-strong)' },
  { code: 'completed', label: 'Completed', color: 'var(--color-g-500)' },
  { code: 'no_show', label: 'No-show', color: 'var(--color-orange-strong)' },
  { code: 'cancelled', label: 'Cancelled', color: 'var(--color-d-600)' },
];

/**
 * `appointments.by_status` → one bar per status. `pending_payment` (an online
 * booking still at checkout) is left out, as it is from the backend's total.
 */
export function statusBars(byStatus: Readonly<Record<string, number>>): BarChartDatum[] {
  return STATUS_BARS.map((s) => ({ l: s.label, v: byStatus[s.code] ?? 0, color: s.color }));
}

/** Doctor roster status → the `Badge` status it renders as. */
export const DOCTOR_STATUS_BADGE: Readonly<Record<DoctorStatus, string>> = {
  active: 'Active',
  on_leave: 'On Leave',
  inactive: 'Inactive',
};

/** Appointment source → `Badge` status (online bookings arrive through Medibook). */
const SOURCE_BADGE: Readonly<Record<string, string>> = {
  online: 'Medibook',
  walk_in: 'Walk-in',
};

export function sourceBadge(source: string): string {
  return SOURCE_BADGE[source] ?? source;
}

/** Why an appointment is on the front desk's needs-action list. */
export type ActionReason = 'unpaid' | 'approval';

export interface ActionItem {
  readonly appt: AppointmentBrief;
  readonly reason: ActionReason;
}

/**
 * Unpaid walk-ins and bookings awaiting approval, one row per appointment
 * (an unpaid walk-in cannot also await approval, but an id is never listed
 * twice), earliest first.
 */
export function actionItems(data: ReceptionDashboard): ActionItem[] {
  const seen = new Set<string>();
  const rows: ActionItem[] = [];
  const add = (appt: AppointmentBrief, reason: ActionReason): void => {
    if (seen.has(appt.id)) return;
    seen.add(appt.id);
    rows.push({ appt, reason });
  };
  data.unpaidWalkIns.items.forEach((a) => add(a, 'unpaid'));
  data.pendingApprovals.items.forEach((a) => add(a, 'approval'));
  return rows.sort((x, y) => x.appt.scheduledStartAt.localeCompare(y.appt.scheduledStartAt));
}

const TIME_FORMAT: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

/** ISO date-time → "10:30 am". */
export function clockTime(iso: string): string {
  return formatInstant(iso, TIME_FORMAT);
}
