/** Query keys for services, tax rates and coupons (standards §4). */
export const servicesKeys = {
  all: ['services-pricing'] as const,
  services: () => [...servicesKeys.all, 'services'] as const,
  taxRates: () => [...servicesKeys.all, 'tax-rates'] as const,
  coupons: () => [...servicesKeys.all, 'coupons'] as const,
};
