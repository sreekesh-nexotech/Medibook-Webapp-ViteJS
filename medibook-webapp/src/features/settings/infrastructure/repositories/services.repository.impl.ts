import { attempt } from '@/core/error/attempt';

import type { ServicesRepository } from '@/features/settings/domain/repositories/services.repository';
import * as api from '@/features/settings/infrastructure/data-sources/remote/services.api';
import {
  toCoupon,
  toCouponRedemption,
  toDoctorServiceLink,
  toService,
  toTaxRate,
} from '@/features/settings/infrastructure/data-sources/remote/services.response';

export const servicesRepository: ServicesRepository = {
  listServices: () => attempt(async () => (await api.getServices()).map(toService)),
  createService: (input) => attempt(async () => toService(await api.postService(input))),
  updateService: (id, input, version) =>
    attempt(async () => toService(await api.patchService(id, input, version))),
  setServiceActive: (id, isActive, version) =>
    attempt(async () => toService(await api.patchServiceActive(id, isActive, version))),
  deleteService: (id) =>
    attempt(async () => {
      await api.deleteService(id);
      return null;
    }),

  listTaxRates: () => attempt(async () => (await api.getTaxRates()).map(toTaxRate)),
  createTaxRate: (input) => attempt(async () => toTaxRate(await api.postTaxRate(input))),
  updateTaxRate: (id, input, version) =>
    attempt(async () => toTaxRate(await api.patchTaxRate(id, input, version))),
  setTaxRateActive: (id, isActive, version) =>
    attempt(async () => toTaxRate(await api.patchTaxRateActive(id, isActive, version))),
  deleteTaxRate: (id, version) =>
    attempt(async () => {
      await api.deleteTaxRate(id, version);
      return null;
    }),

  listCoupons: () => attempt(async () => (await api.getCoupons()).map(toCoupon)),
  createCoupon: (input) => attempt(async () => toCoupon(await api.postCoupon(input))),
  updateCoupon: (id, input, version) =>
    attempt(async () => toCoupon(await api.patchCoupon(id, input, version))),
  setCouponActive: (id, isActive, version) =>
    attempt(async () => toCoupon(await api.patchCouponActive(id, isActive, version))),
  deleteCoupon: (id, version) =>
    attempt(async () => {
      await api.deleteCoupon(id, version);
      return null;
    }),
  listCouponRedemptions: (couponId) =>
    attempt(async () => (await api.getCouponRedemptions(couponId)).map(toCouponRedemption)),

  listDoctorServices: () =>
    attempt(async () => (await api.getDoctorServices()).map(toDoctorServiceLink)),
  linkDoctorService: (input) =>
    attempt(async () => toDoctorServiceLink(await api.postDoctorService(input))),
  updateDoctorServicePrice: (id, priceOverrideRupees) =>
    attempt(async () => toDoctorServiceLink(await api.patchDoctorService(id, priceOverrideRupees))),
  unlinkDoctorService: (id) =>
    attempt(async () => {
      await api.deleteDoctorService(id);
      return null;
    }),
};
