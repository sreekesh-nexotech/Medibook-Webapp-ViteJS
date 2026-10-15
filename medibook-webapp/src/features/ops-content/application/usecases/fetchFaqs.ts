import type { Result } from '@/core/error/failure';

import type { FaqEntry } from '@/features/ops-content/domain/entities/content.entities';
import { contentRepository } from '@/features/ops-content/infrastructure/repositories/content.repository.impl';

export function fetchFaqs(): Promise<Result<readonly FaqEntry[]>> {
  return contentRepository.listFaqs();
}
