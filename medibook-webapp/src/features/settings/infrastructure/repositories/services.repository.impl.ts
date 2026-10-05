import { attempt } from '@/core/error/attempt';

import type { ServicesRepository } from '@/features/settings/domain/repositories/services.repository';
import * as api from '@/features/settings/infrastructure/data-sources/remote/services.api';
import {
  toCoupon,
  toService,
  toTaxRate,
} from '@/features/settings/infrastructure/data-sources/remote/services.response';

export const servicesRepository: ServicesRepository = {
  listServices: () => attempt(async () => (await api.getServices()).map(toService)),
  createService: (input) => attempt(async () => toService(await api.postService(input))),
  updateService: (id, input, version) =>
    attempt(async () => toService(await api.patchService(id, input, version))),
  deleteService: (id) =>
    attempt(async () => {
      await api.deleteService(id);
      return null;
    }),

  listTaxRates: () => attempt(async () => (await api.getTaxRates()).map(toTaxRate)),
  createTaxRate: (input) => attempt(async () => toTaxRate(await api.postTaxRate(input))),
  updateTaxRate: (id, input, version) =>
    attempt(async () => toTaxRate(await api.patchTaxRate(id, input, version))),
  deleteTaxRate: (id) =>
    attempt(async () => {
      await api.deleteTaxRate(id);
      return null;
    }),

  listCoupons: () => attempt(async () => (await api.getCoupons()).map(toCoupon)),
  createCoupon: (input) => attempt(async () => toCoupon(await api.postCoupon(input))),
  updateCoupon: (id, input, version) =>
    attempt(async () => toCoupon(await api.patchCoupon(id, input, version))),
  deleteCoupon: (id) =>
    attempt(async () => {
      await api.deleteCoupon(id);
      return null;
    }),
};
