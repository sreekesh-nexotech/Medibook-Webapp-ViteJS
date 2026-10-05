import type { Result } from '@/core/error/failure';

import type {
  ConfigList,
  FeatureFlag,
} from '@/features/ops-settings/domain/entities/opsSettings.entity';
import { opsSettingsRepository } from '@/features/ops-settings/infrastructure/repositories/opsSettings.repository.impl';

export function fetchOpsFeatureFlags(): Promise<Result<ConfigList<FeatureFlag>>> {
  return opsSettingsRepository.listFeatureFlags();
}
