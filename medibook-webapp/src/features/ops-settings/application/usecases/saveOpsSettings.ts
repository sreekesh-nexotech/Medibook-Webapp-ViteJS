import type { Result } from '@/core/error/failure';

import type {
  PlatformSettings,
  PlatformSettingsValues,
} from '@/features/ops-settings/domain/entities/opsSettings.entity';
import { opsSettingsRepository } from '@/features/ops-settings/infrastructure/repositories/opsSettings.repository.impl';

export function saveOpsSettings(
  values: PlatformSettingsValues,
  version: number,
): Promise<Result<PlatformSettings>> {
  return opsSettingsRepository.saveSettings(values, version);
}
