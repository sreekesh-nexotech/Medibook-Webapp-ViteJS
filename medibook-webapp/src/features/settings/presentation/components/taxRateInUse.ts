import { isFailure } from '@/core/error/failure';

import type { TaxRateInUse } from '@/features/settings/domain/entities/services.entities';

/** 409: the rate cannot be deleted, switched off or narrowed while services bill with it (BE-10). */
export const TAX_RATE_IN_USE = 'TAX_RATE_IN_USE';

/** How many services to name before summarising the rest. */
const NAMED_SERVICES = 5;

export interface TaxRateInUseView extends TaxRateInUse {
  /** "3 services still bill with this rate: ECG, Echo, X-ray. Pick another rate on them first." */
  readonly message: string;
}

function namesOf(meta: Readonly<Record<string, unknown>>): readonly string[] {
  const services = meta.services;
  if (!Array.isArray(services)) return [];
  return services.flatMap((s: unknown) =>
    typeof s === 'object' && s !== null && 'name' in s && typeof s.name === 'string'
      ? [s.name]
      : [],
  );
}

/** The services blocking a tax-rate change (`meta` of the 409), or `null` for any other error. */
export function taxRateInUseOf(error: unknown): TaxRateInUseView | null {
  if (!isFailure(error) || error.code !== TAX_RATE_IN_USE) return null;
  const serviceNames = namesOf(error.meta);
  const count =
    typeof error.meta.service_count === 'number' ? error.meta.service_count : serviceNames.length;
  const shown = serviceNames.slice(0, NAMED_SERVICES).join(', ');
  const rest = count - Math.min(serviceNames.length, NAMED_SERVICES);
  const list = shown ? `: ${shown}${rest > 0 ? ` and ${rest} more` : ''}` : '';
  return {
    serviceCount: count,
    serviceNames,
    message: `${count} service${count === 1 ? ' still bills' : 's still bill'} with this rate${list}. Pick another rate on ${count === 1 ? 'it' : 'them'} first.`,
  };
}
