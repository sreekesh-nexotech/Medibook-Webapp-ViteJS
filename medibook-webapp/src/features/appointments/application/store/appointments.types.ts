/**
 * Interim view-model types + domain constants for the appointments feature,
 * transcribed 1:1 from the design prototype (`data.jsx`). When the real
 * domain/infrastructure layers land, these become domain entities and the
 * constants move behind the API.
 */

/**
 * ============================================================================
 * DEPRECATED master-data constants — read the hospital's own catalogue instead
 * ============================================================================
 * Audit 2.6.3: "The hospital app books against a fixed list of six departments
 * and seven doctors rather than its own Doctors and Departments catalogue, so
 * adding a doctor changes nothing anywhere."
 *
 * The live source of truth is `features/doctors/application/store/catalog.store.ts`,
 * read through `catalog.selectors.ts`:
 *
 *   components →  useCatalogDepartments() / useCatalogDoctorNames(dept) /
 *                 useCatalogFee(key) / useCatalogDoctor(idOrName)
 *   stores     →  selectDepartments(useCatalogStore.getState()) etc.
 *
 * The values below are retained only so that any call site not yet migrated
 * still renders the SAME data as the catalogue and the patient app — audit
 * 2.6.2: "The mobile app and the hospital app use different departments,
 * different doctors, different appointment statuses and different token
 * formats. A reviewer comparing the two sees two different products."
 * They are now the canonical 7 departments and 9 doctors from
 * CANONICAL_MASTER_DATA, not the old divergent list.
 *
 * @deprecated Migrate the call site to `catalog.selectors.ts`, then delete.
 */
export const DEPARTMENTS = [
  'General Medicine',
  'Cardiology',
  'Orthopedics',
  'Pediatrics',
  'Neurology',
  'ENT',
  'Dermatology',
] as const;

/**
 * A department name. Deliberately `string`, not a union over [DEPARTMENTS]: a
 * hospital adds and renames departments at runtime through its own catalogue,
 * so a closed literal type is wrong by construction — it cannot describe a
 * department the hospital created this morning.
 */
export type Department = string;

/**
 * @deprecated Use `useCatalogDoctorNames(dept)` / `selectDoctorNames(state, dept)`.
 */
export const DOCTORS: Readonly<Record<string, readonly string[]>> = {
  'General Medicine': ['Dr. Anil Kumar', 'Dr. Meera Nair'],
  Cardiology: ['Dr. Thomas Kurian', 'Dr. Anya Sharma'],
  Orthopedics: ['Dr. Geetha Rao'],
  Pediatrics: ['Dr. Kumar Venkat'],
  Neurology: ['Dr. Maya Suresh'],
  ENT: ['Dr. Arun Bhat'],
  Dermatology: ['Dr. Leela Pillai'],
};

/**
 * Department base fee in whole rupees — now only a DEFAULT for a doctor with
 * no fee of their own.
 * @deprecated Use `useCatalogFee(key)` / `selectFee(state, key)`, which prefers
 * the doctor's own fee.
 */
export const FEES: Readonly<Record<string, number>> = {
  'General Medicine': 500,
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

/**
 * @deprecated Use `useCatalogDoctor(idOrName)` — it carries `room`, `spec` and
 * `depts` from the catalogue the hospital actually maintains.
 */
export const DOCTOR_META: Readonly<Record<string, DoctorMeta>> = {
  'Dr. Anil Kumar': { room: '101', spec: 'General Physician', dept: 'General Medicine' },
  'Dr. Meera Nair': { room: '102', spec: 'General Physician', dept: 'General Medicine' },
  'Dr. Thomas Kurian': { room: '201', spec: 'Cardiologist', dept: 'Cardiology' },
  'Dr. Anya Sharma': { room: '202', spec: 'Cardiologist', dept: 'Cardiology' },
  'Dr. Geetha Rao': { room: '301', spec: 'Orthopedic Surgeon', dept: 'Orthopedics' },
  'Dr. Kumar Venkat': { room: '401', spec: 'Pediatrician', dept: 'Pediatrics' },
  'Dr. Maya Suresh': { room: '501', spec: 'Neurologist', dept: 'Neurology' },
  'Dr. Arun Bhat': { room: '601', spec: 'ENT Specialist', dept: 'ENT' },
  'Dr. Leela Pillai': { room: '701', spec: 'Dermatologist', dept: 'Dermatology' },
};

/**
 * Design `TOKEN_PREFIX` — kept for call-site compatibility / future
 * per-department token schemes. The live scheme is the canonical hospital-wide
 * "T-001" (CANONICAL_MASTER_DATA section 5), shared with the patient app.
 */
export const TOKEN_PREFIX: Readonly<Record<string, string>> = {
  'General Medicine': 'G',
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
