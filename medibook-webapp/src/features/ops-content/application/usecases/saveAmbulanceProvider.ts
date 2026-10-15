import type { Result } from '@/core/error/failure';

import type {
  AmbulanceDraft,
  AmbulanceProvider,
} from '@/features/ops-content/domain/entities/content.entities';
import { contentRepository } from '@/features/ops-content/infrastructure/repositories/content.repository.impl';

/** Create the ambulanceProvider (`id` null) or update it at `version`. */
export function saveAmbulanceProvider(
  id: string | null,
  draft: AmbulanceDraft,
  version: number,
): Promise<Result<AmbulanceProvider>> {
  return id === null
    ? contentRepository.createAmbulanceProvider(draft)
    : contentRepository.updateAmbulanceProvider(id, draft, version);
}
