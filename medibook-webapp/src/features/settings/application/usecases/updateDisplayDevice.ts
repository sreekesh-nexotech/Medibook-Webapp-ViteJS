import type { Result } from '@/core/error/failure';

import type {
  DisplayDevice,
  DisplayDeviceChanges,
} from '@/features/settings/domain/entities/settings.entities';
import { configRepository } from '@/features/settings/infrastructure/repositories/config.repository.impl';

export function updateDisplayDevice(
  id: string,
  changes: DisplayDeviceChanges,
  version: number,
): Promise<Result<DisplayDevice>> {
  return configRepository.updateDisplayDevice(id, changes, version);
}
