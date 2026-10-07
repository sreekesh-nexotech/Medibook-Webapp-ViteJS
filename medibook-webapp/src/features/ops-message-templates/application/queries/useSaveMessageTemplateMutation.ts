import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { messageTemplatesKeys } from '@/features/ops-message-templates/application/queries/messageTemplates.keys';
import { saveMessageTemplate } from '@/features/ops-message-templates/application/usecases/saveMessageTemplate';
import type { MessageTemplateDraft } from '@/features/ops-message-templates/domain/entities/messageTemplates.entities';

interface SaveInput {
  /** The template being edited, or `null` to create one. */
  readonly id: string | null;
  readonly draft: MessageTemplateDraft;
  /** The version the editor opened on (`If-Match`); ignored on create. */
  readonly version: number;
}

/** Create or edit a template; the list refetches either way, so a conflict shows the latest. */
export function useSaveMessageTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, draft, version }: SaveInput) =>
      unwrap(await saveMessageTemplate(id, draft, version)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: messageTemplatesKeys.list() });
    },
  });
}
