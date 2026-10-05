import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { servicesKeys } from '@/features/settings/application/queries/services.keys';
import { fetchCoupons } from '@/features/settings/application/usecases/services.fetchCoupons';
import { fetchServices } from '@/features/settings/application/usecases/services.fetchServices';
import { fetchTaxRates } from '@/features/settings/application/usecases/services.fetchTaxRates';

/** Prices change rarely; a minute of freshness keeps tab switches instant. */
const PRICING_STALE_TIME_MS = 60_000;

/** The hospital's service catalogue (read by appointments/payments once they integrate). */
export function useServicesQuery() {
  return useQuery({
    queryKey: servicesKeys.services(),
    queryFn: async () => unwrap(await fetchServices()),
    staleTime: PRICING_STALE_TIME_MS,
  });
}

/** The hospital's tax rates, including the platform defaults. */
export function useTaxRatesQuery() {
  return useQuery({
    queryKey: servicesKeys.taxRates(),
    queryFn: async () => unwrap(await fetchTaxRates()),
    staleTime: PRICING_STALE_TIME_MS,
  });
}

export function useCouponsQuery() {
  return useQuery({
    queryKey: servicesKeys.coupons(),
    queryFn: async () => unwrap(await fetchCoupons()),
    staleTime: PRICING_STALE_TIME_MS,
  });
}
