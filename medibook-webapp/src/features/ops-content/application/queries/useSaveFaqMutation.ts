import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { contentKeys } from '@/features/ops-content/application/queries/content.keys';
import { saveFaq } from '@/features/ops-content/application/usecases/saveFaq';
import type { FaqDraft } from '@/features/ops-content/domain/entities/content.entities';

interface SaveInput {
  /** The row being edited, or `null` to create one. */
  readonly id: string | null;
  readonly draft: FaqDraft;
  /** The version the editor opened on (`If-Match`); ignored on create. */
  readonly version: number;
}

/** Create or edit an FAQ entry. Refetches the list on any outcome, so a conflict shows the latest row. */
export function useSaveFaqMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, draft, version }: SaveInput) =>
      unwrap(await saveFaq(id, draft, version)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: contentKeys.faqs() });
    },
  });
}
