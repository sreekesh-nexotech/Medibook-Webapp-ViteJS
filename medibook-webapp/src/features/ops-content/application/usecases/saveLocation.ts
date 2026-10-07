import type { Result } from '@/core/error/failure';

import type {
  ContentLocation,
  LocationDraft,
} from '@/features/ops-content/domain/entities/content.entities';
import { contentRepository } from '@/features/ops-content/infrastructure/repositories/content.repository.impl';

/** Create the location (`id` null) or update it at `version`. */
export function saveLocation(
  id: string | null,
  draft: LocationDraft,
  version: number,
): Promise<Result<ContentLocation>> {
  return id === null
    ? contentRepository.createLocation(draft)
    : contentRepository.updateLocation(id, draft, version);
}
