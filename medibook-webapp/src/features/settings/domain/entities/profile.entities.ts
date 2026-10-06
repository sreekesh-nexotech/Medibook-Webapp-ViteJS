/**
 * Hospital Profile entities (module H4) — the holiday calendar and the banners
 * the hospital publishes to the patient app. Plain readonly types: no Zod, no
 * Axios, no React. (Branches have no backend yet — see the H4 gap list.)
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
  /** Row version, sent as `If-Match` on edit and delete (DATA-05). */
  readonly version: number;
}

/** The closure an edit or removal is about, at the version the screen showed. */
export type HolidayTarget = Pick<Holiday, 'id' | 'version'>;

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
  readonly patientName: string;
  /** ISO date-time. */
  readonly scheduledStartAt: string;
}

/**
 * The outcome of a holiday write. A dry run applies nothing and lists what
 * confirming would cancel (with a 100% refund); a confirmed write applied it.
 */
export interface ScheduleChange {
  readonly dryRun: boolean;
  readonly affectedBookings: readonly AffectedBooking[];
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
