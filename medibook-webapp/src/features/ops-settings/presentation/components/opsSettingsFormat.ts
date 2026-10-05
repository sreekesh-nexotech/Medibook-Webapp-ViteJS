import type { TaxAppliesTo } from '@/features/ops-settings/domain/entities/opsSettings.entity';

/** Basis points in one percent. */
const BP_PER_PERCENT = 100;

/** Most decimals a percentage input keeps (one basis point). */
const PERCENT_DECIMALS = 2;

/** `1800` → `"18%"`, `1250` → `"12.5%"`. */
export function formatRateBp(bp: number): string {
  return `${Number((bp / BP_PER_PERCENT).toFixed(PERCENT_DECIMALS))}%`;
}

/** `1800` → `"18"`, for seeding a percentage input. */
export function bpToPercentInput(bp: number): string {
  return String(Number((bp / BP_PER_PERCENT).toFixed(PERCENT_DECIMALS)));
}

/** `"18"` → `1800`; `null` when the text is not a number. */
export function percentInputToBp(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.round(n * BP_PER_PERCENT) : null;
}

/** Display label per tax applicability. */
export const APPLIES_TO_LABEL: Readonly<Record<TaxAppliesTo, string>> = {
  consultation: 'Consultation',
  service: 'Service',
  convenience_fee: 'Convenience Fee',
  all: 'All',
};

/** The Applies To select's options, in the backend's order. */
export const APPLIES_TO_OPTIONS: readonly TaxAppliesTo[] = [
  'consultation',
  'service',
  'convenience_fee',
  'all',
];

/** Session timeout as the select spells it: `30` → `"30 min"`. */
export function timeoutLabel(minutes: number): string {
  return `${minutes} min`;
}

/** The Session Timeout select's standard choices (a stored value off this list is added). */
export const SESSION_TIMEOUT_OPTIONS: readonly string[] = ['15 min', '30 min', '60 min'];
