import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { contentKeys } from '@/features/ops-content/application/queries/content.keys';
import { removeFaq } from '@/features/ops-content/application/usecases/removeFaq';

interface DeleteInput {
  readonly id: string;
  readonly version: number;
}

/** Remove an FAQ entry (soft delete on the server, D-07). */
export function useDeleteFaqMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, version }: DeleteInput) => unwrap(await removeFaq(id, version)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: contentKeys.faqs() });
    },
  });
}
