import type { Result } from '@/core/error/failure';

import type {
  FeatureFlag,
  FeatureFlagChanges,
} from '@/features/ops-settings/domain/entities/opsSettings.entity';
import { opsSettingsRepository } from '@/features/ops-settings/infrastructure/repositories/opsSettings.repository.impl';

export function updateOpsFeatureFlag(
  key: string,
  changes: FeatureFlagChanges,
): Promise<Result<FeatureFlag>> {
  return opsSettingsRepository.updateFeatureFlag(key, changes);
}
