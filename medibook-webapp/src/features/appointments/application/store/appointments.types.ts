/**
 * Interim view-model types + domain constants for the appointments feature,
 * transcribed 1:1 from the design prototype (`data.jsx`). When the real
 * domain/infrastructure layers land, these become domain entities and the
 * constants move behind the API.
 */

/** The six seeded departments (design `DEPARTMENTS`). */
export const DEPARTMENTS = [
  'Cardiology',
  'Orthopedics',
  'Pediatrics',
  'Neurology',
  'ENT',
  'Dermatology',
] as const;

export type Department = (typeof DEPARTMENTS)[number];

/** Doctors per department (design `DOCTORS`). */
export const DOCTORS: Readonly<Record<Department, readonly string[]>> = {
  Cardiology: ['Dr. Thomas K.', 'Dr. Anil R.'],
  Orthopedics: ['Dr. Geetha R.'],
  Pediatrics: ['Dr. Kumar V.'],
  Neurology: ['Dr. Maya S.'],
  ENT: ['Dr. Arun B.'],
  Dermatology: ['Dr. Leela P.'],
};

/** Consultation fee per department (design `FEES`). */
export const FEES: Readonly<Record<Department, number>> = {
  Cardiology: 800,
  Orthopedics: 700,
  Pediatrics: 600,
  Neurology: 1000,
  ENT: 500,
  Dermatology: 650,
};

/** Per-doctor metadata (room, specialization) — used by the live queue & doctor profile. */
export interface DoctorMeta {
  readonly room: string;
  readonly spec: string;
  readonly dept: Department;
}

/** Design `DOCTOR_META`, keyed by doctor display name. */
export const DOCTOR_META: Readonly<Record<string, DoctorMeta>> = {
  'Dr. Thomas K.': { room: '101', spec: 'Cardiologist', dept: 'Cardiology' },
  'Dr. Anil R.': { room: '102', spec: 'Cardiologist', dept: 'Cardiology' },
  'Dr. Geetha R.': { room: '201', spec: 'Orthopedic Surgeon', dept: 'Orthopedics' },
  'Dr. Kumar V.': { room: '301', spec: 'Pediatrician', dept: 'Pediatrics' },
  'Dr. Maya S.': { room: '401', spec: 'Neurologist', dept: 'Neurology' },
  'Dr. Arun B.': { room: '501', spec: 'ENT Specialist', dept: 'ENT' },
  'Dr. Leela P.': { room: '601', spec: 'Dermatologist', dept: 'Dermatology' },
};

/**
 * Design `TOKEN_PREFIX` — kept for call-site compatibility / future
 * per-department token schemes (the live scheme is hospital-wide "T-001").
 */
export const TOKEN_PREFIX: Readonly<Record<Department, string>> = {
  Cardiology: 'C',
  Orthopedics: 'O',
  Pediatrics: 'P',
  Neurology: 'N',
  ENT: 'E',
  Dermatology: 'D',
};

/** "Online" = pre-booked + pre-paid via the Medibook app; "Walk-in" = booked at the desk. */
export type AppointmentSource = 'Online' | 'Walk-in';

/**
 * `Waived` is the audited fee-waiver state (HA-09): the consultation happened,
 * no money was taken, and the reason is recorded on the appointment. It is
 * deliberately not `Paid` — nothing was collected — and not `Pending` either,
 * because there is nothing left to collect.
 */
export type PaymentState = 'Paid' | 'Pending' | 'Refunded' | 'Waived';

export type AppointmentStatus = 'Scheduled' | 'In Queue' | 'Completed' | 'Cancelled' | 'No-show';

export type Gender = 'Male' | 'Female' | 'Other';

/** Where a refund was pushed back out. */
export type RefundChannel = 'Desk' | 'Medibook';

/** Desk payment modes offered by the Mark Payment flow. */
export type PaymentMode = 'Cash' | 'UPI' | 'Card';

/** A doctor's live queue status (design `docStatus` values). */
export type DoctorStatus = 'Available' | 'Consulting' | 'Waiting' | 'On Break';

export interface Appointment {
  readonly id: string;
  readonly mrn: string;
  readonly name: string;
  readonly age: number;
  readonly gender: Gender;
  readonly phone: string;
  readonly dept: Department;
  readonly doctor: string;
  readonly source: AppointmentSource;
  /** Relative demo label — "Today", "Tomorrow" or a "14 Jun"-style date. */
  readonly date: string;
  /** Slot label, e.g. "8:30 am". */
  readonly time: string;
  readonly amount: number;
  readonly payment: PaymentState;
  readonly token: string | null;
  readonly status: AppointmentStatus;
  readonly remark: string;
  /** Lifecycle fields written by actions after seed time. */
  readonly payMode?: PaymentMode;
  readonly payRef?: string;
  /** Epoch ms the token was called for consultation; null after a skip. */
  readonly calledAt?: number | null;
  /** Queue re-order stamp set when a patient is skipped to the back. */
  readonly qorder?: number;
  readonly cancelReason?: string;
  /** Who pushed the refund out: the desk (cash back) or Medibook (online). */
  readonly refundVia?: RefundChannel;
  /** Amount actually refunded — may be less than the gross paid (partial refund). */
  readonly refundAmount?: number;
  readonly refundReason?: string;
  /** Epoch ms the refund was recorded. */
  readonly refundedAt?: number;
  /**
   * Desk confirmation still owed (HA-05). Online bookings that arrive
   * unconfirmed sit here until someone with `Appointments.edit` approves them;
   * until then they cannot be checked in, paid for or given a token.
   */
  readonly needsApproval?: boolean;
  /** Epoch ms the desk approved the booking. */
  readonly approvedAt?: number;
  /** Waived fee (HA-09) — the amount forgone and why. A waiver needs a reason. */
  readonly waivedAmount?: number;
  readonly waiveReason?: string;
  readonly waivedAt?: number;
  /**
   * Receipt-series number, `MB/R/2026-27/000123`, minted once per payment and
   * then stable: re-opening a receipt must never renumber it.
   */
  readonly receiptNo?: string;
}
