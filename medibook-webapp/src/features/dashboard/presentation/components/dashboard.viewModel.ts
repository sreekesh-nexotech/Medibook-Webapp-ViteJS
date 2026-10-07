import { formatTimeIn, formatWeekdayDayIn, isoDayIn } from '@/shared/lib/hospitalTime';
import type { BarChartDatum } from '@/shared/ui/BarChart';

import type {
  AdminDashboard,
  AppointmentBrief,
  QueueSession,
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
  { code: 'no_show', label: 'No-show', color: 'var(--color-orange)' },
  { code: 'cancelled', label: 'Cancelled', color: 'var(--color-d-500)' },
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

/** The hospital-local day of a front-desk row (BE-26 sends it; else read it off the start). */
export function briefDay(appt: AppointmentBrief, timeZone: string): string {
  return appt.scheduledDate ?? isoDayIn(appt.scheduledStartAt, timeZone);
}

/**
 * When a needs-action row is due, in the hospital's zone: the clock time for
 * today's, the day and time for any other day (UAT-62 — an approval for next
 * week must not look due now).
 */
export function actionWhen(appt: AppointmentBrief, today: string, timeZone: string): string {
  const time = formatTimeIn(appt.scheduledStartAt, timeZone);
  const day = briefDay(appt, timeZone);
  return day === today ? time : `${formatWeekdayDayIn(day, timeZone)} · ${time}`;
}

/* ---------------------------------------------------------- live queue */

const LIVE_SESSION_STATUSES: ReadonlySet<string> = new Set(['open', 'paused']);

/**
 * A session has a patient at the desk now (UAT-61): its current appointment
 * is set — the backend clears it on done, skip, no-show and close — and the
 * session is still running.
 */
export function isSessionServing(session: QueueSession): boolean {
  return session.currentAppointmentId !== null && LIVE_SESSION_STATUSES.has(session.status);
}

export interface DepartmentQueueRow {
  readonly id: string;
  readonly name: string;
  readonly waiting: number;
  readonly isServing: boolean;
  /** The token at the desk, by the hospital's own label (BE-20); `null` when not sent. */
  readonly servingLabel: string | null;
}

/**
 * One row per active department: its sessions' waiting tokens and whether a
 * patient is at a desk. Sessions name their department (BE-20) or are joined
 * through the doctor roster; labels are never invented (no `T-012`).
 */
export function departmentQueueRows(
  departments: readonly {
    readonly id: string;
    readonly name: string;
    readonly isActive: boolean;
  }[],
  sessions: readonly QueueSession[],
  departmentOfDoctor: ReadonlyMap<string, string>,
): readonly DepartmentQueueRow[] {
  return departments
    .filter((d) => d.isActive)
    .map((d) => {
      const own = sessions.filter(
        (s) => (s.departmentId ?? departmentOfDoctor.get(s.doctorId)) === d.id,
      );
      const serving = own.find(isSessionServing);
      return {
        id: d.id,
        name: d.name,
        waiting: own.reduce((n, s) => n + s.waitingCount, 0),
        isServing: serving !== undefined,
        servingLabel: serving?.currentTokenLabel ?? null,
      };
    });
}

/* -------------------------------------------------------------- revenue */

const CHANNEL_LABEL: Readonly<Record<string, string>> = {
  online: 'Online (collected by Medibook)',
  desk: 'At the desk',
};

const METHOD_LABEL: Readonly<Record<string, string>> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  pos: 'POS',
  netbanking: 'Net banking',
  wallet: 'Wallet',
  emi: 'EMI',
  paylater: 'Pay later',
  other: 'Other',
};

export interface RevenueRow {
  readonly key: string;
  readonly label: string;
  readonly collected: number;
  /** `null` when the backend does not split refunds this way (pre-DASH-02). */
  readonly refunded: number | null;
  readonly net: number | null;
}

function rows(
  collected: Readonly<Record<string, number>>,
  refunded: Readonly<Record<string, number>> | null,
  labels: Readonly<Record<string, string>>,
  fixed: readonly string[],
): readonly RevenueRow[] {
  const keys = Array.from(
    new Set([...fixed, ...Object.keys(collected), ...Object.keys(refunded ?? {})]),
  ).filter((k) => k !== 'null');
  return keys
    .map((key) => {
      const c = collected[key] ?? 0;
      const r = refunded ? (refunded[key] ?? 0) : null;
      return {
        key,
        label: labels[key] ?? key,
        collected: c,
        refunded: r,
        net: r === null ? null : c - r,
      };
    })
    .filter((row) => fixed.includes(row.key) || row.collected !== 0 || (row.refunded ?? 0) !== 0);
}

/** Collections (and refunds, once split) by channel: online vs desk (R1). */
export function revenueByChannel(data: AdminDashboard): readonly RevenueRow[] {
  return rows(data.collectedByChannel, data.refundedByChannel, CHANNEL_LABEL, ['online', 'desk']);
}

/** Collections (and refunds, once split) by payment method, largest first. */
export function revenueByMethod(data: AdminDashboard): readonly RevenueRow[] {
  return [...rows(data.collectedByMethod, data.refundedByMethod, METHOD_LABEL, [])].sort(
    (a, b) => b.collected - a.collected,
  );
}
