import type { Result } from '@/core/error/failure';

import type { LegalDocument } from '@/features/ops-content/domain/entities/content.entities';
import { contentRepository } from '@/features/ops-content/infrastructure/repositories/content.repository.impl';

export function fetchLegalDocuments(): Promise<Result<readonly LegalDocument[]>> {
  return contentRepository.listLegalDocuments();
}
