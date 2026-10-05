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
  readonly pendingPatientChanges: number;
  readonly unpaidWalkInsToday: number;
  readonly cashSessionsToReconcile: number;
}

export interface AdminDashboard {
  readonly period: DashboardPeriod;
  readonly dateFrom: string;
  readonly dateTo: string;
  /** Every booking in the window except those still awaiting online payment. */
  readonly appointmentsTotal: number;
  /** Appointment status code (`scheduled`, `completed`, …) → count. */
  readonly appointmentsByStatus: Readonly<Record<string, number>>;
  /** Appointment source (`online`, `walk_in`) → count. */
  readonly appointmentsBySource: Readonly<Record<string, number>>;
  readonly collectedRupees: number;
  readonly refundedRupees: number;
  /** Collected minus refunded. */
  readonly netRupees: number;
  /** Payment channel (`online`, `desk`) → rupees collected. */
  readonly collectedByChannel: Readonly<Record<string, number>>;
  /** Payment method (`cash`, `upi`, `card`, …) → rupees collected. */
  readonly collectedByMethod: Readonly<Record<string, number>>;
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
  readonly label: string;
  readonly status: string;
  /** The token being served, `null` when nobody is with the doctor. */
  readonly currentTokenNo: number | null;
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
  readonly scheduledStartAt: string;
  readonly doctorName: string;
  readonly patientName: string;
}

export interface AppointmentBriefList {
  readonly count: number;
  /** The first 25, earliest first. */
  readonly items: readonly AppointmentBrief[];
}

export interface ReceptionDashboard {
  readonly date: string;
  readonly sessions: readonly QueueSession[];
  readonly queueSummary: QueueSummary;
  readonly pendingApprovals: AppointmentBriefList;
  readonly unpaidWalkIns: AppointmentBriefList;
}
