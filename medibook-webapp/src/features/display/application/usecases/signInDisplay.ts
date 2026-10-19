import type { Result } from '@/core/error/failure';

import type { DisplayGrant } from '@/features/display/domain/entities/display.types';
import { displayRepository } from '@/features/display/infrastructure/repositories/display.repository.impl';

export function signInDisplay(deviceKey: string): Promise<Result<DisplayGrant>> {
  return displayRepository.signIn(deviceKey);
}
