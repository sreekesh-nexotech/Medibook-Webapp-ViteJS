import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type {
  CouponInput,
  DoctorServiceLinkInput,
  ServiceInput,
  TaxRateInput,
} from '@/features/settings/domain/entities/services.entities';
import { servicesKeys } from '@/features/settings/application/queries/services.keys';
import { createCoupon } from '@/features/settings/application/usecases/services.createCoupon';
import { createService } from '@/features/settings/application/usecases/services.createService';
import { createTaxRate } from '@/features/settings/application/usecases/services.createTaxRate';
import { deleteCoupon } from '@/features/settings/application/usecases/services.deleteCoupon';
import { deleteService } from '@/features/settings/application/usecases/services.deleteService';
import { deleteTaxRate } from '@/features/settings/application/usecases/services.deleteTaxRate';
import { linkDoctorService } from '@/features/settings/application/usecases/services.linkDoctorService';
import { setCouponActive } from '@/features/settings/application/usecases/services.setCouponActive';
import { setServiceActive } from '@/features/settings/application/usecases/services.setServiceActive';
import { setTaxRateActive } from '@/features/settings/application/usecases/services.setTaxRateActive';
import { unlinkDoctorService } from '@/features/settings/application/usecases/services.unlinkDoctorService';
import { updateCoupon } from '@/features/settings/application/usecases/services.updateCoupon';
import { updateDoctorServicePrice } from '@/features/settings/application/usecases/services.updateDoctorServicePrice';
import { updateService } from '@/features/settings/application/usecases/services.updateService';
import { updateTaxRate } from '@/features/settings/application/usecases/services.updateTaxRate';

/** A save is a create when `existing` is absent, else an `If-Match` update. */
interface Save<I> {
  readonly input: I;
  readonly existing?: { readonly id: string; readonly version: number };
}

/** One row and the version its change is sent with (`If-Match`). */
interface VersionedRow {
  readonly id: string;
  readonly version: number;
}

interface ActiveChange extends VersionedRow {
  readonly isActive: boolean;
}

export function useSaveServiceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ input, existing }: Save<ServiceInput>) =>
      unwrap(
        await (existing
          ? updateService(existing.id, input, existing.version)
          : createService(input)),
      ),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: servicesKeys.services() });
      // A service's rate counts towards that rate's `services_count`.
      void queryClient.invalidateQueries({ queryKey: servicesKeys.taxRates() });
    },
  });
}

export function useSetServiceActiveMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive, version }: ActiveChange) =>
      unwrap(await setServiceActive(id, isActive, version)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: servicesKeys.services() });
      void queryClient.invalidateQueries({ queryKey: servicesKeys.taxRates() });
    },
  });
}

export function useDeleteServiceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteService(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: servicesKeys.services() });
      void queryClient.invalidateQueries({ queryKey: servicesKeys.taxRates() });
      void queryClient.invalidateQueries({ queryKey: servicesKeys.doctorServices() });
      // Legacy service scope rows go with the service (BE-25).
      void queryClient.invalidateQueries({ queryKey: servicesKeys.coupons() });
    },
  });
}

export function useSaveTaxRateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ input, existing }: Save<TaxRateInput>) =>
      unwrap(
        await (existing
          ? updateTaxRate(existing.id, input, existing.version)
          : createTaxRate(input)),
      ),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: servicesKeys.taxRates() });
    },
  });
}

export function useSetTaxRateActiveMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive, version }: ActiveChange) =>
      unwrap(await setTaxRateActive(id, isActive, version)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: servicesKeys.taxRates() });
    },
  });
}

export function useDeleteTaxRateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, version }: VersionedRow) => unwrap(await deleteTaxRate(id, version)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: servicesKeys.taxRates() });
      void queryClient.invalidateQueries({ queryKey: servicesKeys.services() });
    },
  });
}

export function useSaveCouponMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ input, existing }: Save<CouponInput>) =>
      unwrap(
        await (existing ? updateCoupon(existing.id, input, existing.version) : createCoupon(input)),
      ),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: servicesKeys.coupons() });
    },
  });
}

export function useSetCouponActiveMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive, version }: ActiveChange) =>
      unwrap(await setCouponActive(id, isActive, version)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: servicesKeys.coupons() });
    },
  });
}

export function useDeleteCouponMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, version }: VersionedRow) => unwrap(await deleteCoupon(id, version)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: servicesKeys.coupons() });
    },
  });
}

/** Doctor ↔ service links: add, re-price, remove. Every change re-reads the links. */
export function useDoctorServiceMutations() {
  const queryClient = useQueryClient();
  const onSettled = (): void => {
    void queryClient.invalidateQueries({ queryKey: servicesKeys.doctorServices() });
  };
  const link = useMutation({
    mutationFn: async (input: DoctorServiceLinkInput) => unwrap(await linkDoctorService(input)),
    onSettled,
  });
  const reprice = useMutation({
    mutationFn: async ({
      id,
      priceOverrideRupees,
    }: {
      readonly id: string;
      readonly priceOverrideRupees: number | null;
    }) => unwrap(await updateDoctorServicePrice(id, priceOverrideRupees)),
    onSettled,
  });
  const unlink = useMutation({
    mutationFn: async (id: string) => unwrap(await unlinkDoctorService(id)),
    onSettled,
  });
  return { link, reprice, unlink };
}
