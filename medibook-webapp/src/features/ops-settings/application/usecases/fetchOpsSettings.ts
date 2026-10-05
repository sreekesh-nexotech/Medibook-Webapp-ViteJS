import type { Result } from '@/core/error/failure';

import type { PlatformSettings } from '@/features/ops-settings/domain/entities/opsSettings.entity';
import { opsSettingsRepository } from '@/features/ops-settings/infrastructure/repositories/opsSettings.repository.impl';

export function fetchOpsSettings(): Promise<Result<PlatformSettings>> {
  return opsSettingsRepository.getSettings();
}
