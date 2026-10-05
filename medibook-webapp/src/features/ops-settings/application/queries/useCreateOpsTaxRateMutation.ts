import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { TaxRateValues } from '@/features/ops-settings/domain/entities/opsSettings.entity';
import { opsSettingsKeys } from '@/features/ops-settings/application/queries/opsSettings.keys';
import { createOpsTaxRate } from '@/features/ops-settings/application/usecases/createOpsTaxRate';

export function useCreateOpsTaxRateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: TaxRateValues) => unwrap(await createOpsTaxRate(values)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: opsSettingsKeys.taxRates() }),
  });
}
