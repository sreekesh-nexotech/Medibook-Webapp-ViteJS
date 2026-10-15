import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { contentKeys } from '@/features/ops-content/application/queries/content.keys';
import { publishLegalDraft } from '@/features/ops-content/application/usecases/publishLegalDraft';
import type { LegalSlug } from '@/features/ops-content/domain/entities/content.entities';

/** Publish a slug's latest draft: it becomes the version patients see and consent to. */
export function usePublishLegalDraftMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (slug: LegalSlug) => unwrap(await publishLegalDraft(slug)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: contentKeys.legal() });
    },
  });
}
