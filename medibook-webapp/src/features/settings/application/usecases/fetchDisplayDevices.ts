import type { Result } from '@/core/error/failure';

import type { DisplayDevice } from '@/features/settings/domain/entities/settings.entities';
import { configRepository } from '@/features/settings/infrastructure/repositories/config.repository.impl';

export function fetchDisplayDevices(): Promise<Result<readonly DisplayDevice[]>> {
  return configRepository.listDisplayDevices();
}
