import type { Result } from '@/core/error/failure';

import { contentRepository } from '@/features/ops-content/infrastructure/repositories/content.repository.impl';

export function removeAmbulanceProvider(id: string, version: number): Promise<Result<null>> {
  return contentRepository.deleteAmbulanceProvider(id, version);
}
