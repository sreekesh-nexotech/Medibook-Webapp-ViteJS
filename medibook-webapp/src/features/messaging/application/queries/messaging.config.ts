/** Freshness for the messaging query hooks. */

/** Platform templates change rarely and never from this app. */
export const MESSAGING_TEMPLATES_STALE_TIME_MS = 5 * 60_000;

/** Delivery statuses move as the gateway works, so the outbox re-checks often. */
export const MESSAGING_DELIVERIES_STALE_TIME_MS = 15_000;
