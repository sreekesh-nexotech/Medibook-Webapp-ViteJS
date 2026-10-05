import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { TaxRateValues } from '@/features/ops-settings/domain/entities/opsSettings.entity';
import { opsSettingsKeys } from '@/features/ops-settings/application/queries/opsSettings.keys';
import { updateOpsTaxRate } from '@/features/ops-settings/application/usecases/updateOpsTaxRate';

interface UpdateOpsTaxRateInput {
  readonly id: string;
  readonly values: TaxRateValues;
  readonly version: number;
}

/** Edit a tax rate; a version conflict also re-reads the list. */
export function useUpdateOpsTaxRateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values, version }: UpdateOpsTaxRateInput) =>
      unwrap(await updateOpsTaxRate(id, values, version)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: opsSettingsKeys.taxRates() }),
  });
}
