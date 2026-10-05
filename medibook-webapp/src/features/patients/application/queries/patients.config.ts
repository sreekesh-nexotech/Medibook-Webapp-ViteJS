/** Freshness and size limits shared by the patients query hooks. */

/** Patient records change rarely while a screen is open. */
export const PATIENTS_STALE_TIME_MS = 30_000;

/** Booking history reads the backend's largest page: the latest 100 visits. */
export const PATIENT_HISTORY_LIMIT = 100;

/** A visit count needs only the `total`, so the page holds one row. */
export const PATIENT_VISIT_COUNT_LIMIT = 1;
