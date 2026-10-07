import type { Result } from '@/core/error/failure';

import type { DisplayDeviceWithKey } from '@/features/settings/domain/entities/settings.entities';
import { configRepository } from '@/features/settings/infrastructure/repositories/config.repository.impl';

export function rotateDisplayDeviceKey(id: string): Promise<Result<DisplayDeviceWithKey>> {
  return configRepository.rotateDisplayDeviceKey(id);
}
