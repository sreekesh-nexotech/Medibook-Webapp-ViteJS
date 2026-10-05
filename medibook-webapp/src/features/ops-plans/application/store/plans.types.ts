/**
 * Plan-limit vocabulary shared by the plan cards and the plan modal (audit
 * SA-02: plans cap more than bookings and staff).
 */

/**
 * One plan ceiling. `null` means **unlimited**; a number is a real cap — so a
 * plan that allows `0` doctors is a different plan from one with no doctor
 * ceiling at all. Unlimited is its own value that no arithmetic can produce by
 * accident.
 */
export type PlanLimit = number | null;

/** The dimensions in the order they are shown on cards and in the modal. */
const PLAN_LIMIT_KEYS = [
  'bookings',
  'staff',
  'doctors',
  'branches',
  'storageGb',
  'messageCredits',
] as const;

export type PlanLimitKey = (typeof PLAN_LIMIT_KEYS)[number];
