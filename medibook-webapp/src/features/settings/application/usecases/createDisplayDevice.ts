import type { Result } from '@/core/error/failure';

import type { DisplayDeviceWithKey } from '@/features/settings/domain/entities/settings.entities';
import { configRepository } from '@/features/settings/infrastructure/repositories/config.repository.impl';

export function createDisplayDevice(name: string): Promise<Result<DisplayDeviceWithKey>> {
  return configRepository.createDisplayDevice(name);
}
