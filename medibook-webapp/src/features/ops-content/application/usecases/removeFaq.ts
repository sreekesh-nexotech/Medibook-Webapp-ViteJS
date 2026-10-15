import type { Result } from '@/core/error/failure';

import { contentRepository } from '@/features/ops-content/infrastructure/repositories/content.repository.impl';

export function removeFaq(id: string, version: number): Promise<Result<null>> {
  return contentRepository.deleteFaq(id, version);
}
