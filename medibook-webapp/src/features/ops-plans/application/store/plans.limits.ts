/**
 * Pure helpers for plan ceilings and yearly pricing (audit SA-02). No React,
 * no stores — the catalog screen and the plan modal read the
 * same rules from here, so "unlimited" can never drift into meaning zero.
 */
import type { PlanLimit, PlanLimitKey } from '@/features/ops-plans/application/store/plans.types';

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
  staff: { label: 'Staff accounts', unit: 'accounts', placeholder: 'e.g. 120' },
  doctors: { label: 'Doctor profiles', unit: 'doctors', placeholder: 'e.g. 40' },
  storageGb: { label: 'Storage', unit: 'GB', placeholder: 'e.g. 100' },
};

/** `PlanWriteSerializer.gst_rate_bp` default: 18%. */
export const DEFAULT_GST_RATE_BP = 1800;

/**
 * The trial a new plan starts with when the platform default cannot be read
 * (no `settings.view`): the seeded `default_trial_days` (Q101, CLAUDE.md §11).
 */
export const FALLBACK_TRIAL_DAYS = 14;

/** `PlanWriteSerializer.trial_days` ceiling. */
export const MAX_TRIAL_DAYS = 365;

const BP_PER_PERCENT = 100;
const MAX_GST_PERCENT = 100;

/** `1800` → `"18"`, `250` → `"2.5"` — the percent field's text. */
export function bpToPercentText(bp: number): string {
  return String(bp / BP_PER_PERCENT);
}

/** `"18"` → 1800; `undefined` unless 0–100 with at most two decimals. */
export function parseGstPercent(raw: string): number | undefined {
  const text = raw.trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) return undefined;
  const percent = Number(text);
  if (percent > MAX_GST_PERCENT) return undefined;
  return Math.round(percent * BP_PER_PERCENT);
}

export function gstPercentError(raw: string): string | undefined {
  if (raw.trim() === '') return 'GST rate is required — enter 0 for none.';
  return parseGstPercent(raw) === undefined
    ? 'GST rate must be a percentage from 0 to 100, e.g. 18.'
    : undefined;
}

/** Whole days, 0–365; `undefined` otherwise. */
export function parseTrialDays(raw: string): number | undefined {
  const n = parseLimitInput(raw);
  return n !== undefined && n <= MAX_TRIAL_DAYS ? n : undefined;
}

export function trialDaysError(raw: string): string | undefined {
  if (raw.trim() === '') return 'Trial days is required — enter 0 for no trial.';
  return parseTrialDays(raw) === undefined
    ? `Trial days must be a whole number from 0 to ${MAX_TRIAL_DAYS}.`
    : undefined;
}

/** A whole number, negative allowed (it only orders the catalog). */
export function parseSortOrder(raw: string): number | undefined {
  const text = raw.trim();
  if (!/^-?\d{1,6}$/.test(text)) return undefined;
  return Number(text);
}

export function sortOrderError(raw: string): string | undefined {
  return parseSortOrder(raw) === undefined
    ? 'Catalog position must be a whole number, e.g. 10.'
    : undefined;
}

/** "14-day trial", "No trial". */
export function trialLabel(days: number): string {
  return days > 0 ? `${days}-day trial` : 'No trial';
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
