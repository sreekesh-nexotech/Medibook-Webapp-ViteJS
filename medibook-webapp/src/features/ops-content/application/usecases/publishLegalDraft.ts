import type { Result } from '@/core/error/failure';

import type {
  LegalDocument,
  LegalSlug,
} from '@/features/ops-content/domain/entities/content.entities';
import { contentRepository } from '@/features/ops-content/infrastructure/repositories/content.repository.impl';

export function publishLegalDraft(slug: LegalSlug): Promise<Result<LegalDocument>> {
  return contentRepository.publishLegalDraft(slug);
}
