import type { Result } from '@/core/error/failure';

import type { FeatureFlag } from '@/features/ops-settings/domain/entities/opsSettings.entity';
import { opsSettingsRepository } from '@/features/ops-settings/infrastructure/repositories/opsSettings.repository.impl';

export function setOpsFeatureFlagEnabled(
  key: string,
  enabled: boolean,
): Promise<Result<FeatureFlag>> {
  return opsSettingsRepository.setFeatureFlagEnabled(key, enabled);
}
