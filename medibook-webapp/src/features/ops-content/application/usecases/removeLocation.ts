import type { Result } from '@/core/error/failure';

import { contentRepository } from '@/features/ops-content/infrastructure/repositories/content.repository.impl';

export function removeLocation(id: string, version: number): Promise<Result<null>> {
  return contentRepository.deleteLocation(id, version);
}
