/**
 * Ops hospital-registry view-model types (interim entities for the static-seed
 * phase). Shapes transcribed from the design prototype's `OpsDB.hospitals` and
 * the hospital-hub rosters in `Ops.jsx`.
 */

/** Lifecycle state of a hospital instance on the platform. */
export type HospitalStatus = 'Active' | 'Pending verification' | 'Suspended' | 'Rejected';

/** Verification state of a single KYC document. */
export type KycState = 'Verified' | 'Submitted' | 'Missing';

/** The four KYC document slots requested from the admin email at onboarding. */
export type KycDocKey = 'reg' | 'gst' | 'licence' | 'bankproof';

/** Per-document KYC states for one hospital. */
export type KycRecord = Readonly<Record<KycDocKey, KycState>>;

/** Why the platform paused a hospital. */
export type SuspensionReason = 'Non-payment' | 'Compliance' | 'Manual review';

/**
 * An in-force suspension (audit SA-03: "no suspension-for-non-payment
 * state"). Present only while `status === 'Suspended'`, and kept as a record
 * rather than a flag so the console can say *why*, *since when* and *which
 * invoice* — and so an unsuspend clears the whole story at once.
 */
export interface HospitalSuspension {
  readonly reason: SuspensionReason;
  /** Local-calendar ISO date the suspension took effect. */
  readonly since: string;
  /** The unpaid invoice that triggered it, for `Non-payment`. */
  readonly invoiceNo?: string;
  /** Operations user who applied it. */
  readonly by: string;
  readonly note?: string;
}

/** Payout bank account on file for a hospital. */
export interface Bank {
  readonly bank: string;
  readonly account: string;
  readonly ifsc: string;
  readonly upi: string;
}

/** One hospital instance in the operations registry. */
export interface OpsHospital {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly gstin?: string;
  readonly plan: string;
  readonly city: string;
  readonly st: string;
  readonly bookings: number;
  readonly onboarded: string;
  readonly status: HospitalStatus;
  readonly kyc?: KycRecord;
  readonly bank?: Bank;
  readonly rejectReason?: string;
  /** Set while the instance is suspended; cleared when it is reactivated. */
  readonly suspension?: HospitalSuspension;
  /**
   * Per-hospital payment grace window in days, overriding the platform
   * default. `0` is a real value — no grace at all — so it must stay
   * distinguishable from "not configured" (`undefined`).
   */
  readonly graceDays?: number;
}

/** Department row in the ops hospital hub's read-only roster. */
export interface OpsDept {
  readonly name: string;
  readonly docs: number;
  readonly fee: number;
  readonly hours: string;
  readonly status: 'Active' | 'Inactive';
}

/** Upcoming leave shown on a roster doctor (live Apollo rows only). */
export interface OpsDoctorLeave {
  readonly from: string;
  readonly to: string;
  readonly reason?: string;
}

/** Doctor row in the ops hospital hub's read-only roster. */
export interface OpsDoctor {
  readonly name: string;
  readonly spec: string;
  readonly dept: string;
  readonly room: string;
  readonly fee: number;
  /** Pre-formatted to one decimal, matching the prototype's `.toFixed(1)`. */
  readonly rating: string;
  readonly days: number;
  /** 'Inactive' can flow through from the live Apollo catalog roster. */
  readonly status: 'Active' | 'On Leave' | 'Inactive';
  readonly leave: OpsDoctorLeave | null;
}

/** Status of a recent-booking row in the ops hospital hub. */
export type OpsBookingStatus = 'Scheduled' | 'In Queue' | 'Completed' | 'No-show' | 'Cancelled';

/** Recent-booking row in the ops hospital hub. */
export interface OpsBooking {
  readonly id: number;
  readonly patient: string;
  readonly department: string;
  readonly date: string;
  readonly status: OpsBookingStatus;
}
