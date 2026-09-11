/**
 * Interim view-model types for the Hospital Settings screen (design
 * `data.jsx` `DEFAULT_SETTINGS`). The string-valued rule fields hold the
 * exact option labels the settings screen's selects offer (e.g. "15 mins",
 * "Auto", "Auto Mark No-show").
 */

export interface MapPin {
  readonly x: number;
  readonly y: number;
}

export interface HospitalBank {
  readonly accountName: string;
  readonly bank: string;
  readonly account: string;
  readonly ifsc: string;
  readonly upi: string;
}

export interface HospitalRules {
  /** Default consultation length, e.g. "15 mins" (`selectSlotLengthMinutes`). */
  readonly duration: string;
  readonly onlineBooking: boolean;
  /**
   * How far ahead the booking calendar is open, e.g. "30 days"
   * (`selectSchedulingHorizonDays`). Beyond it no slot is offered, in the
   * patient app or at the desk.
   */
  readonly horizon: string;
  /**
   * Concurrent capacity of ONE slot time — how many patients may hold the
   * same 9:30 am slot before it reads Full, e.g. "15 slots"
   * (`selectMaxPerSlot`). It is not a daily cap.
   */
  readonly maxPerSlot: string;
  /**
   * Gap that follows each consultation, e.g. "15 mins"
   * (`selectSlotBufferMinutes`). The buffer sits **after** the consultation,
   * never inside it: a 15-minute consultation with a 15-minute buffer gives
   * the patient 15 minutes and consumes 30 minutes of the doctor's day.
   */
  readonly buffer: string;
  readonly allowCancel: boolean;
  readonly cancelBefore: string;
  readonly autoNoShow: string;
  readonly tokenGen: string;
  /**
   * Token numbering scheme — one of `TOKEN_SCHEME_OPTIONS`. Defaults to the
   * canonical hospital-wide `T-001` series (CANONICAL_MASTER_DATA §5).
   */
  readonly tokenScheme: string;
  readonly showToken: boolean;
  readonly allowHold: boolean;
  readonly holdTimeout: string;
  readonly grace: string;
  readonly afterGrace: string;
  readonly opFee: string;
  readonly feeValidity: string;
  readonly applyAllDepts: boolean;
}

export interface HospitalNotify {
  readonly confirm: boolean;
  readonly reminder: boolean;
  readonly settleReceived: boolean;
  readonly settleOverdue: boolean;
  readonly quotaLow: boolean;
}

export interface HospitalSettings {
  readonly name: string;
  readonly regNo: string;
  readonly gstin: string;
  readonly phone: string;
  readonly email: string;
  readonly about: string;
  readonly address: string;
  readonly lat: string;
  readonly lng: string;
  /** Logo image data-URL, or null when none uploaded. */
  readonly logo: string | null;
  /** Map pin position in % of the map box. */
  readonly pin: MapPin;
  readonly hoursOpen: string;
  readonly hoursClose: string;
  /** Open flags Mon..Sun (7 entries). */
  readonly hoursDays: readonly boolean[];
  readonly bank: HospitalBank;
  readonly rules: HospitalRules;
  readonly notify: HospitalNotify;
}
