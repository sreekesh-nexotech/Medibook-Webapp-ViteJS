/** Freshness for the slots query hooks. */

/** Slots fill up as patients book, so the grid goes stale quickly. */
export const SLOT_GRID_STALE_TIME_MS = 15_000;

/** A bulk preview must reflect the inventory the moment it is confirmed. */
export const BULK_PREVIEW_STALE_TIME_MS = 0;

/** Generation runs happen on a schedule, a few times a day. */
export const GENERATION_RUN_STALE_TIME_MS = 60_000;
