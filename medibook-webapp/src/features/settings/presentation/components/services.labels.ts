import type {
  ServiceTaxRate,
  TaxAppliesTo,
} from '@/features/settings/domain/entities/services.entities';

/** Shared display copy for the Services & Pricing modals and screen. */

export const NO_TAX_LABEL = 'No tax (exempt)';

/** "GST 18%" / "GST 18% (incl.)". */
export function taxLabel(tax: Pick<ServiceTaxRate, 'name' | 'percent' | 'isInclusive'>): string {
  return `${tax.name} ${tax.percent}%${tax.isInclusive ? ' (incl.)' : ''}`;
}

/** What a hospital rate may be applied to (the convenience fee is the platform's). */
export const APPLIES_TO: readonly { readonly value: TaxAppliesTo; readonly label: string }[] = [
  { value: 'service', label: 'Services' },
  { value: 'consultation', label: 'Consultations' },
  { value: 'all', label: 'Services & consultations' },
];

export function appliesToLabel(value: TaxAppliesTo): string {
  return APPLIES_TO.find((a) => a.value === value)?.label ?? 'Convenience fee';
}
