import type { Result } from '@/core/error/failure';

import type { FaqDraft, FaqEntry } from '@/features/ops-content/domain/entities/content.entities';
import { contentRepository } from '@/features/ops-content/infrastructure/repositories/content.repository.impl';

/** Create the faq (`id` null) or update it at `version`. */
export function saveFaq(
  id: string | null,
  draft: FaqDraft,
  version: number,
): Promise<Result<FaqEntry>> {
  return id === null
    ? contentRepository.createFaq(draft)
    : contentRepository.updateFaq(id, draft, version);
}
