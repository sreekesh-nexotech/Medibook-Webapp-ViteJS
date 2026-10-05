/** Freshness for the ops billing query hooks. */

/** The ledger moves as hospitals pay and the dunning job runs. */
export const BILLING_STALE_TIME_MS = 30_000;

/** A subscription's plan and grace override change rarely. */
export const SUBSCRIPTION_STALE_TIME_MS = 5 * 60_000;
