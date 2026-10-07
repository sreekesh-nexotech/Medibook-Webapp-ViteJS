import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { messageTemplatesKeys } from '@/features/ops-message-templates/application/queries/messageTemplates.keys';
import { removeMessageTemplate } from '@/features/ops-message-templates/application/usecases/removeMessageTemplate';

interface DeleteInput {
  readonly id: string;
  readonly version: number;
}

/** Remove a template (soft delete); the list refetches. */
export function useDeleteMessageTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, version }: DeleteInput) =>
      unwrap(await removeMessageTemplate(id, version)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: messageTemplatesKeys.list() });
    },
  });
}
