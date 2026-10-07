/**
 * Hospital Profile entities (module H4) — the holiday calendar and the banners
 * the hospital publishes to the patient app. Plain readonly types: no Zod, no
 * Axios, no React. There are no branches: one hospital = one location (D-02).
 */

/** A closure. `departmentId === null` closes the whole hospital. */
export interface Holiday {
  readonly id: string;
  readonly name: string;
  /** ISO `yyyy-mm-dd`, both ends inclusive. */
  readonly from: string;
  readonly to: string;
  readonly departmentId: string | null;
  readonly note: string | null;
  /** Row version: `If-Match` on edit (required) and delete (decision 10, UAT-05). */
  readonly version: number;
}

/** The closure a write targets, at the version the user saw. */
export interface HolidayRef {
  readonly id: string;
  readonly version: number;
}

export interface HolidayInput {
  readonly name: string;
  readonly from: string;
  readonly to: string;
  readonly departmentId: string | null;
  readonly note: string | null;
}

/** One booking a calendar change would cancel (dry run) or did cancel (confirm). */
export interface AffectedBooking {
  readonly appointmentId: string;
  readonly bookingRef: string;
  readonly tokenLabel: string | null;
  readonly patientName: string;
  /** ISO date-time. */
  readonly scheduledStartAt: string;
}

/**
 * The outcome of a holiday write. A dry run applies nothing and lists what
 * confirming would cancel (with a 100% refund); a confirmed write applied it.
 * Same envelope as every schedule-affecting write (`ScheduleChangeSerializer`).
 */
export interface ScheduleChange {
  readonly dryRun: boolean;
  readonly affectedBookings: readonly AffectedBooking[];
  readonly result: null;
  /** The dry run's fingerprint, echoed on confirm (BE-33); `null` when not issued. */
  readonly previewToken: string | null;
  /** The applied change queued a slot re-generation. */
  readonly rematerialisationQueued: boolean;
}

/**
 * How one holiday write is sent: a dry run with a fresh `Idempotency-Key`,
 * or the confirm with the action's key (reused on retry) and the preview token.
 */
export interface HolidayWriteMode {
  readonly confirm: boolean;
  readonly idempotencyKey: string;
  readonly previewToken?: string | null;
}

/** Who a hospital banner reaches in the patient app. */
export type BannerAudience = 'hospital_patients' | 'all_patients_in_city';

/** A banner the hospital publishes to the patient app. */
export interface HospitalBanner {
  readonly id: string;
  readonly title: string;
  readonly body: string | null;
  readonly imageFileId: string | null;
  readonly audience: BannerAudience;
  /** ISO date-times; `null` = open-ended. */
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  /** Rotation position — lower shows first. */
  readonly sortOrder: number;
  /** `false` = paused: out of rotation, schedule kept. */
  readonly isEnabled: boolean;
  /** Server-computed: enabled, inside its window, and the hospital is visible in the app. */
  readonly published: boolean;
  readonly version: number;
}

export interface BannerInput {
  readonly title: string;
  readonly body: string | null;
  readonly imageFileId: string | null;
  readonly audience: BannerAudience;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
}

/** A partial banner update. Omitted fields keep their value. */
export interface BannerChanges extends Partial<BannerInput> {
  readonly sortOrder?: number;
  readonly isEnabled?: boolean;
}
