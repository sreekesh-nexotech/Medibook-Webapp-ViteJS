import type { Result } from '@/core/error/failure';

import type { PrintTemplate } from '@/features/settings/domain/entities/settings.entities';
import { configRepository } from '@/features/settings/infrastructure/repositories/config.repository.impl';

export function fetchPrintTemplates(): Promise<Result<readonly PrintTemplate[]>> {
  return configRepository.listPrintTemplates();
}
