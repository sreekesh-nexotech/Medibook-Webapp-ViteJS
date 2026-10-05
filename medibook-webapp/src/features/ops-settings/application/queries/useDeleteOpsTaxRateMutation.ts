import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { opsSettingsKeys } from '@/features/ops-settings/application/queries/opsSettings.keys';
import { deleteOpsTaxRate } from '@/features/ops-settings/application/usecases/deleteOpsTaxRate';

interface DeleteOpsTaxRateInput {
  readonly id: string;
  readonly version: number;
}

export function useDeleteOpsTaxRateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, version }: DeleteOpsTaxRateInput) =>
      unwrap(await deleteOpsTaxRate(id, version)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: opsSettingsKeys.taxRates() }),
  });
}
