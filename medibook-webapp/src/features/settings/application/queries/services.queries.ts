import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { servicesKeys } from '@/features/settings/application/queries/services.keys';
import { fetchCouponRedemptions } from '@/features/settings/application/usecases/services.fetchCouponRedemptions';
import { fetchCoupons } from '@/features/settings/application/usecases/services.fetchCoupons';
import { fetchDoctorServices } from '@/features/settings/application/usecases/services.fetchDoctorServices';
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

/** The bookings one coupon was used on; idle until a coupon is picked. */
export function useCouponRedemptionsQuery(couponId: string | null) {
  return useQuery({
    queryKey: servicesKeys.redemptions(couponId ?? ''),
    queryFn: async () => unwrap(await fetchCouponRedemptions(couponId ?? '')),
    enabled: couponId !== null,
    staleTime: PRICING_STALE_TIME_MS,
  });
}

/** Which doctors offer which services, with any per-doctor price. */
export function useDoctorServicesQuery() {
  return useQuery({
    queryKey: servicesKeys.doctorServices(),
    queryFn: async () => unwrap(await fetchDoctorServices()),
    staleTime: PRICING_STALE_TIME_MS,
  });
}
