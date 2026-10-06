import type { Result } from '@/core/error/failure';

import type {
  CouponInput,
  HospitalCoupon,
  PricedService,
  ServiceInput,
  ServiceTaxRate,
  TaxRateInput,
} from '@/features/settings/domain/entities/services.entities';

/** The hospital's services, tax rates and coupons. */
export interface ServicesRepository {
  listServices(): Promise<Result<readonly PricedService[]>>;
  createService(input: ServiceInput): Promise<Result<PricedService>>;
  /** `version` is sent as `If-Match`. */
  updateService(id: string, input: ServiceInput, version: number): Promise<Result<PricedService>>;
  deleteService(id: string): Promise<Result<null>>;

  /** The hospital's own rates plus the platform defaults (read-only). */
  listTaxRates(): Promise<Result<readonly ServiceTaxRate[]>>;
  createTaxRate(input: TaxRateInput): Promise<Result<ServiceTaxRate>>;
  updateTaxRate(id: string, input: TaxRateInput, version: number): Promise<Result<ServiceTaxRate>>;
  deleteTaxRate(id: string, version: number): Promise<Result<null>>;

  listCoupons(): Promise<Result<readonly HospitalCoupon[]>>;
  createCoupon(input: CouponInput): Promise<Result<HospitalCoupon>>;
  updateCoupon(id: string, input: CouponInput, version: number): Promise<Result<HospitalCoupon>>;
  deleteCoupon(id: string, version: number): Promise<Result<null>>;
}
