import type { Result } from '@/core/error/failure';

import type { DisplayBoard } from '@/features/display/domain/entities/display.types';
import type { DisplaySelection } from '@/features/settings/domain/entities/settings.entities';
import { configRepository } from '@/features/settings/infrastructure/repositories/config.repository.impl';

/** What a screen with this unsaved selection shows now (writes nothing). */
export function previewDisplay(selection: DisplaySelection): Promise<Result<DisplayBoard>> {
  return configRepository.previewDisplay(selection);
}

/** What this saved screen shows now, without its key. */
export function previewDisplayDevice(id: string): Promise<Result<DisplayBoard>> {
  return configRepository.previewDisplayDevice(id);
}
