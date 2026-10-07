import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { contentKeys } from '@/features/ops-content/application/queries/content.keys';
import { createLegalDraft } from '@/features/ops-content/application/usecases/createLegalDraft';
import { updateLegalDraft } from '@/features/ops-content/application/usecases/updateLegalDraft';
import type { LegalDraft } from '@/features/ops-content/domain/entities/content.entities';

/** A new draft of a slug, or an edit of an existing (unpublished) draft. */
export type SaveLegalDraftInput =
  | { readonly kind: 'create'; readonly draft: LegalDraft }
  | {
      readonly kind: 'update';
      readonly id: string;
      readonly changes: Pick<LegalDraft, 'title' | 'bodyMd'>;
    };

/** Save a legal-document draft; the version list is refetched either way. */
export function useSaveLegalDraftMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveLegalDraftInput) =>
      unwrap(
        input.kind === 'create'
          ? await createLegalDraft(input.draft)
          : await updateLegalDraft(input.id, input.changes),
      ),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: contentKeys.legal() });
    },
  });
}
