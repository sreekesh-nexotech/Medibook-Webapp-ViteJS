/**
 * Pure helpers for plan ceilings and yearly pricing (audit SA-02). No React,
 * no stores — the catalog screen, the plan modal and the store all read the
 * same rules from here, so "unlimited" can never drift into meaning zero.
 */
import type {
  Plan,
  PlanLimit,
  PlanLimitKey,
  PlanLimits,
} from '@/features/ops-plans/application/store/plans.types';

/** The value that means "no ceiling". Spelled once so nothing else invents it. */
export const UNLIMITED: PlanLimit = null;

/** Months in a yearly term, for the implied-discount arithmetic. */
const MONTHS_PER_YEAR = 12;

/** Label, unit noun and input placeholder for each dimension. */
export const PLAN_LIMIT_META: Readonly<
  Record<
    PlanLimitKey,
    { readonly label: string; readonly unit: string; readonly placeholder: string }
  >
> = {
  bookings: { label: 'Bookings', unit: '/ period', placeholder: 'e.g. 5000' },
  staff: { label: 'Staff accounts', unit: 'accounts', placeholder: 'e.g. 120' },
  doctors: { label: 'Doctor profiles', unit: 'doctors', placeholder: 'e.g. 40' },
  branches: { label: 'Branches', unit: 'branches', placeholder: 'e.g. 3' },
  storageGb: { label: 'Storage', unit: 'GB', placeholder: 'e.g. 100' },
  messageCredits: { label: 'Message credits', unit: 'credits', placeholder: 'e.g. 10000' },
};

/** True when the dimension has no ceiling. */
export function isUnlimited(limit: PlanLimit): boolean {
  return limit === null;
}

/** "Unlimited", "0 doctors", "5,000 / period" — never a bare 0 for unlimited. */
export function formatLimit(limit: PlanLimit, unit?: string): string {
  if (limit === null) return 'Unlimited';
  const n = limit.toLocaleString('en-IN');
  return unit ? `${n} ${unit}` : n;
}

/**
 * Parse what the user typed into a ceiling. Returns `undefined` when the text
 * is not a non-negative integer, so the caller can show an inline error —
 * `0` parses successfully and stays a real cap of zero.
 */
export function parseLimitInput(raw: string): number | undefined {
  const text = raw.trim();
  if (text === '') return undefined;
  if (!/^\d+$/.test(text)) return undefined;
  const n = Number(text);
  return Number.isSafeInteger(n) ? n : undefined;
}

/** Inline message for a ceiling field, or `undefined` when it is acceptable. */
export function limitError(raw: string, label: string): string | undefined {
  if (raw.trim() === '') return `${label} is required — or mark it unlimited.`;
  return parseLimitInput(raw) === undefined
    ? `${label} must be a whole number of 0 or more.`
    : undefined;
}

/** Discount the yearly price implies against 12 monthly payments, in percent. */
export function yearlyDiscountPct(monthly: number, yearly: number): number {
  const full = monthly * MONTHS_PER_YEAR;
  if (full <= 0) return 0;
  return Math.round((1 - yearly / full) * 100);
}

/** What 12 months of monthly billing costs — the yearly price's reference point. */
export function yearlyListPrice(monthly: number): number {
  return monthly * MONTHS_PER_YEAR;
}

/** The cadences a plan can actually be billed on. */
export function billingPeriodsOf(
  plan: Plan,
): readonly ['Monthly'] | readonly ['Monthly', 'Yearly'] {
  return plan.yearlyPrice === null ? (['Monthly'] as const) : (['Monthly', 'Yearly'] as const);
}

/**
 * The legacy numeric booking quota other features still read. Unlimited
 * bookings become `Infinity` so a percentage bar degrades to 0% rather than
 * dividing by zero — see `Plan.quota`.
 */
export function bookingQuotaMirror(limits: PlanLimits): number {
  return limits.bookings ?? Number.POSITIVE_INFINITY;
}
