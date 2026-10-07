import type { Result } from '@/core/error/failure';

import type { PrintPreview } from '@/features/settings/domain/entities/settings.entities';
import { configRepository } from '@/features/settings/infrastructure/repositories/config.repository.impl';

export function previewPrintTemplate(id: string): Promise<Result<PrintPreview>> {
  return configRepository.previewPrintTemplate(id);
}
