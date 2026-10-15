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

/**
 * What a new or edited rate may apply to. The convenience-fee GST is the
 * platform setting, not a tax-rate row (BE-18), so `convenience_fee` is no
 * longer offered — an old row that has it keeps showing it until changed.
 */
export const APPLIES_TO_OPTIONS: readonly TaxAppliesTo[] = ['consultation', 'service', 'all'];

/** The Applies To choices for a rate currently set to `current`. */
export function appliesToOptionsFor(current: TaxAppliesTo): readonly TaxAppliesTo[] {
  return APPLIES_TO_OPTIONS.includes(current)
    ? APPLIES_TO_OPTIONS
    : [current, ...APPLIES_TO_OPTIONS];
}

/** Session timeout as the select spells it: `30` → `"30 min"`. */
export function timeoutLabel(minutes: number): string {
  return `${minutes} min`;
}

/** The Session Timeout select's standard choices (a stored value off this list is added). */
export const SESSION_TIMEOUT_OPTIONS: readonly string[] = ['15 min', '30 min', '60 min'];

/** Services named in a `TAX_RATE_IN_USE` refusal before "and N more". */
const IN_USE_NAMES = 3;

/**
 * The message for a refused tax-rate change (B4 `409 TAX_RATE_IN_USE`:
 * hospital services still link the rate), naming a few of them; `null` for
 * any other failure.
 */
export function taxRateInUseMessage(
  code: string | null,
  meta: Readonly<Record<string, unknown>>,
): string | null {
  if (code !== 'TAX_RATE_IN_USE') return null;
  const services = Array.isArray(meta.services) ? meta.services : [];
  const names = services
    .map((s: unknown) =>
      typeof s === 'object' && s !== null && 'name' in s && typeof s.name === 'string'
        ? s.name
        : null,
    )
    .filter((n): n is string => n !== null);
  const count = typeof meta.service_count === 'number' ? meta.service_count : names.length;
  const shown = names.slice(0, IN_USE_NAMES).join(', ');
  const more = count > IN_USE_NAMES ? ` and ${count - IN_USE_NAMES} more` : '';
  const list = shown ? ` (${shown}${more})` : '';
  return `${count} hospital ${count === 1 ? 'service still uses' : 'services still use'} this rate${list}. Hospitals must move ${count === 1 ? 'it' : 'them'} to another rate first.`;
}
