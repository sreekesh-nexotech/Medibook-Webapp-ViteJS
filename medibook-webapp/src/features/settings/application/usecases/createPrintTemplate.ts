import type { Result } from '@/core/error/failure';

import type {
  PrintTemplate,
  PrintTemplateInput,
} from '@/features/settings/domain/entities/settings.entities';
import { configRepository } from '@/features/settings/infrastructure/repositories/config.repository.impl';

export function createPrintTemplate(input: PrintTemplateInput): Promise<Result<PrintTemplate>> {
  return configRepository.createPrintTemplate(input);
}
