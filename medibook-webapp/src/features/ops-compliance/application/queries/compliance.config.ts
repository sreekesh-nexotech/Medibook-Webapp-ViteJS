/** Freshness for the compliance query hooks. */

/** Sign-ins and changes accrue continuously; a list half a minute old is fine for an audit read. */
export const COMPLIANCE_LOGS_STALE_TIME_MS = 30_000;

/** DSR statuses move with processing and the nightly run. */
export const COMPLIANCE_REQUESTS_STALE_TIME_MS = 15_000;
