/**
 * Hospital dashboard entities — `GET /api/v1/hospital/dashboard/admin` and
 * `/dashboard/reception` (backend `analytics/services/dashboard.py`). Counts and
 * sums only; money is in rupees (the API sends paise).
 */

/** The admin dashboard's reporting windows (backend `PERIODS`). */
export type DashboardPeriod = 'today' | '7d' | '30d' | 'mtd';

export interface DepartmentLoad {
  readonly departmentId: string;
  readonly name: string;
  readonly appointments: number;
}

export interface DoctorLoad {
  readonly doctorId: string;
  readonly name: string;
  readonly appointments: number;
  readonly completed: number;
}

export interface DashboardAlerts {
  readonly pendingApprovals: number;
  /** Of those, the ones for today (BE-26); `null` from a backend that does not say. */
  readonly pendingApprovalsToday: number | null;
  readonly pendingPatientChanges: number;
  readonly unpaidWalkInsToday: number;
  readonly cashSessionsToReconcile: number;
}

export interface AdminDashboard {
  readonly period: DashboardPeriod;
  readonly dateFrom: string;
  readonly dateTo: string;
  /**
   * Bookings in a live state (awaiting approval, scheduled, in the queue,
   * completed) — one definition with the charts (DASH-01). Older backends
   * counted cancellations and no-shows in their total; the mapper takes them
   * out so the figure means the same either way.
   */
  readonly appointmentsBooked: number;
  readonly appointmentsCancelled: number;
  readonly appointmentsNoShow: number;
  /** Appointment status code (`scheduled`, `completed`, …) → count. */
  readonly appointmentsByStatus: Readonly<Record<string, number>>;
  /** Appointment source (`online`, `walk_in`) → count. */
  readonly appointmentsBySource: Readonly<Record<string, number>>;
  /** `appointmentsBySource` leaves out cancellations and no-shows (DASH-01). */
  readonly bySourceIsLive: boolean;
  readonly collectedRupees: number;
  readonly refundedRupees: number;
  /** Collected minus refunded. */
  readonly netRupees: number;
  /** Payment channel (`online`, `desk`) → rupees collected. */
  readonly collectedByChannel: Readonly<Record<string, number>>;
  /** Payment method (`cash`, `upi`, `card`, …) → rupees collected. */
  readonly collectedByMethod: Readonly<Record<string, number>>;
  /** Channel → method → rupees collected (DASH-02); `null` from an older backend. */
  readonly collectedByChannelMethod: Readonly<
    Record<string, Readonly<Record<string, number>>>
  > | null;
  /** Refunds processed in the window by channel / method (DASH-02); `null` when not split. */
  readonly refundedByChannel: Readonly<Record<string, number>> | null;
  readonly refundedByMethod: Readonly<Record<string, number>> | null;
  /** Busiest first. */
  readonly departments: readonly DepartmentLoad[];
  /** The five busiest doctors, busiest first. */
  readonly topDoctors: readonly DoctorLoad[];
  readonly alerts: DashboardAlerts;
}

/** One doctor session's live queue (`tokens/services/queue.py` `snapshot`). */
export interface QueueSession {
  readonly id: string;
  readonly doctorId: string;
  /** The doctor's department when the snapshot carries it (BE-20); else join the roster. */
  readonly departmentId: string | null;
  readonly label: string;
  readonly status: string;
  /**
   * The appointment at the desk (called or with the doctor), `null` when the
   * desk is free (UAT-61). `current_token_no` is never cleared by the backend,
   * so it is not "serving".
   */
  readonly currentAppointmentId: string | null;
  /** The hospital's label of the token at the desk (BE-20), when sent. */
  readonly currentTokenLabel: string | null;
  readonly waitingCount: number;
  readonly completedCount: number;
}

export interface QueueSummary {
  readonly total: number;
  readonly waiting: number;
  readonly checkedIn: number;
  readonly inConsultation: number;
  readonly completed: number;
  readonly noShow: number;
  readonly cancelled: number;
}

/** An appointment as the front-desk lists show it. */
export interface AppointmentBrief {
  readonly id: string;
  readonly bookingRef: string;
  readonly tokenLabel: string | null;
  readonly status: string;
  readonly source: string;
  readonly paymentStatus: string;
  readonly totalRupees: number;
  /** Hospital-local day (BE-26); `null` from an older backend — read it off the start time. */
  readonly scheduledDate: string | null;
  readonly scheduledStartAt: string;
  readonly doctorName: string;
  readonly patientName: string;
}

export interface AppointmentBriefList {
  readonly count: number;
  /** The first 25, earliest first. */
  readonly items: readonly AppointmentBrief[];
}

/** Bookings awaiting approval: the day's (BE-26) and how many wait on other days. */
export interface PendingApprovals extends AppointmentBriefList {
  /** Approvals on other days; `null` from a backend that lists every day here. */
  readonly otherDaysCount: number | null;
}

/** The signed-in staff member's open cash drawer, if any. */
export interface CashDrawerBrief {
  readonly id: string;
  readonly businessDate: string;
  readonly openedAt: string;
  readonly counterCode: string | null;
  readonly openingFloatRupees: number;
  readonly expectedCashRupees: number;
}

export interface ReceptionDashboard {
  readonly date: string;
  readonly sessions: readonly QueueSession[];
  readonly queueSummary: QueueSummary;
  readonly pendingApprovals: PendingApprovals;
  readonly unpaidWalkIns: AppointmentBriefList;
  readonly cashSession: CashDrawerBrief | null;
}
