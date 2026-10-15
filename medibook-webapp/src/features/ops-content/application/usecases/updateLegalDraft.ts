import type { Result } from '@/core/error/failure';

import type {
  LegalDocument,
  LegalDraft,
} from '@/features/ops-content/domain/entities/content.entities';
import { contentRepository } from '@/features/ops-content/infrastructure/repositories/content.repository.impl';

export function updateLegalDraft(
  id: string,
  changes: Pick<LegalDraft, 'title' | 'bodyMd'>,
): Promise<Result<LegalDocument>> {
  return contentRepository.updateLegalDraft(id, changes);
}
