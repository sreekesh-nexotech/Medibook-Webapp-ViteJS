import type { Result } from '@/core/error/failure';

import type { ContentLocation } from '@/features/ops-content/domain/entities/content.entities';
import { contentRepository } from '@/features/ops-content/infrastructure/repositories/content.repository.impl';

export function fetchLocations(): Promise<Result<readonly ContentLocation[]>> {
  return contentRepository.listLocations();
}
