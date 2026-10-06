import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type {
  CouponInput,
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
import { updateCoupon } from '@/features/settings/application/usecases/services.updateCoupon';
import { updateService } from '@/features/settings/application/usecases/services.updateService';
import { updateTaxRate } from '@/features/settings/application/usecases/services.updateTaxRate';

/** A save is a create when `existing` is absent, else an `If-Match` update. */
interface Save<I> {
  readonly input: I;
  readonly existing?: { readonly id: string; readonly version: number };
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
    },
  });
}

export function useDeleteServiceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteService(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: servicesKeys.services() });
      // A deleted service drops out of coupon scopes.
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

/** A row at the version the screen showed, for `If-Match` (DATA-05). */
interface VersionedRow {
  readonly id: string;
  readonly version: number;
}

export function useDeleteTaxRateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, version }: VersionedRow) => unwrap(await deleteTaxRate(id, version)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: servicesKeys.taxRates() });
      // Services pointing at the rate become exempt.
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

export function useDeleteCouponMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, version }: VersionedRow) => unwrap(await deleteCoupon(id, version)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: servicesKeys.coupons() });
    },
  });
}
