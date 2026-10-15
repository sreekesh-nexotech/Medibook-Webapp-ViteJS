import type { Result } from '@/core/error/failure';

import type {
  PrintTemplate,
  PrintTemplateInput,
} from '@/features/settings/domain/entities/settings.entities';
import { configRepository } from '@/features/settings/infrastructure/repositories/config.repository.impl';

export function updatePrintTemplate(
  id: string,
  changes: Omit<Partial<PrintTemplateInput>, 'kind'>,
  version: number,
): Promise<Result<PrintTemplate>> {
  return configRepository.updatePrintTemplate(id, changes, version);
}
