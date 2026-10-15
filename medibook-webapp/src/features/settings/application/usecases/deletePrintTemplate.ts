import type { Result } from '@/core/error/failure';

import { configRepository } from '@/features/settings/infrastructure/repositories/config.repository.impl';

export function deletePrintTemplate(id: string): Promise<Result<null>> {
  return configRepository.deletePrintTemplate(id);
}
