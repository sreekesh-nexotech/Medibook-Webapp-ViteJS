import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { contentKeys } from '@/features/ops-content/application/queries/content.keys';
import { removeLocation } from '@/features/ops-content/application/usecases/removeLocation';

interface DeleteInput {
  readonly id: string;
  readonly version: number;
}

/** Remove a location (soft delete on the server, D-07). */
export function useDeleteLocationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, version }: DeleteInput) => unwrap(await removeLocation(id, version)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: contentKeys.locations() });
    },
  });
}
