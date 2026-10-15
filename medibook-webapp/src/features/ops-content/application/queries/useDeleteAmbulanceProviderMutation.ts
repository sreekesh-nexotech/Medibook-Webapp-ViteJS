import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { contentKeys } from '@/features/ops-content/application/queries/content.keys';
import { removeAmbulanceProvider } from '@/features/ops-content/application/usecases/removeAmbulanceProvider';

interface DeleteInput {
  readonly id: string;
  readonly version: number;
}

/** Remove an ambulance provider (soft delete on the server, D-07). */
export function useDeleteAmbulanceProviderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, version }: DeleteInput) =>
      unwrap(await removeAmbulanceProvider(id, version)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: contentKeys.ambulance() });
    },
  });
}
