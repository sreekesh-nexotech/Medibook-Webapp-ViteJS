import type { Result } from '@/core/error/failure';

import type { DisplayBoard } from '@/features/display/domain/entities/display.types';
import { displayRepository } from '@/features/display/infrastructure/repositories/display.repository.impl';

export function fetchDisplayBoard(accessToken: string): Promise<Result<DisplayBoard>> {
  return displayRepository.board(accessToken);
}
