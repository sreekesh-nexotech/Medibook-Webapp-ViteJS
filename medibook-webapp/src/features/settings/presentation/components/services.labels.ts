import type {
  ServiceTaxRate,
  TaxAppliesTo,
} from '@/features/settings/domain/entities/services.entities';

/** Shared display copy and small input rules for the Services & Pricing modals and screen. */

export const NO_TAX_LABEL = 'No tax (exempt)';

/** The department choice for a service that belongs to no single department (UAT-25). */
export const HOSPITAL_WIDE_LABEL = 'Hospital-wide (all departments)';

/** "GST 18%" / "GST 18% (incl.)". */
export function taxLabel(tax: Pick<ServiceTaxRate, 'name' | 'percent' | 'isInclusive'>): string {
  return `${tax.name} ${tax.percent}%${tax.isInclusive ? ' (incl.)' : ''}`;
}

/** What a hospital rate may be applied to (the convenience fee is the platform's, BE-18). */
export const APPLIES_TO: readonly { readonly value: TaxAppliesTo; readonly label: string }[] = [
  { value: 'service', label: 'Services' },
  { value: 'consultation', label: 'Consultations' },
  { value: 'all', label: 'Services & consultations' },
];

export function appliesToLabel(value: TaxAppliesTo): string {
  return APPLIES_TO.find((a) => a.value === value)?.label ?? 'Convenience fee';
}

/** True when the rate would tax consultations, which are GST-exempt by default (O-04). */
export function taxesConsultations(value: TaxAppliesTo): boolean {
  return value === 'consultation' || value === 'all';
}

/**
 * The "Applies to" choices a hospital is offered. Consultations are exempt
 * (O-04 default, decision 7), so a new rate is for services; a rate that
 * already taxes consultations keeps its value visible so it can be narrowed.
 */
export function appliesToChoices(current: TaxAppliesTo | null): readonly TaxAppliesTo[] {
  return current !== null && current !== 'service' && taxesConsultations(current)
    ? ['service', current]
    : ['service'];
}

/** The backend's code shape for services and tax rates (BE-33). */
const CATALOGUE_CODE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,39}$/;

/** Why a typed code would be refused; empty is fine (the server makes one). */
export function catalogueCodeError(value: string): string | undefined {
  const code = value.trim();
  if (code === '') return undefined;
  return CATALOGUE_CODE.test(code)
    ? undefined
    : 'Use letters, digits, “-”, “_” or “.”, starting with a letter or digit (40 at most).';
}

/**
 * A rupee price override as typed: empty = the service's own price (`null`),
 * whole rupees otherwise; `undefined` when it is not a valid amount.
 */
export function overrideFromText(text: string): number | null | undefined {
  const raw = text.trim();
  if (raw === '') return null;
  return /^\d+$/.test(raw) ? Number(raw) : undefined;
}
