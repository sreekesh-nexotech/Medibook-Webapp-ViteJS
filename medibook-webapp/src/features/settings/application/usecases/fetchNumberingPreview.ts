import type { Result } from '@/core/error/failure';

import { configRepository } from '@/features/settings/infrastructure/repositories/config.repository.impl';

export function fetchNumberingPreview(kind: string): Promise<Result<string>> {
  return configRepository.previewNumbering(kind);
}
