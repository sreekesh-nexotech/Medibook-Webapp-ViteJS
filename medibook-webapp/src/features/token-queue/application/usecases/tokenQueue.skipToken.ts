import type { Result } from '@/core/error/failure';

import type { SkipOutcome } from '@/features/token-queue/domain/entities/tokenQueue.entities';
import { tokenQueueRepository } from '@/features/token-queue/infrastructure/repositories/tokenQueue.repository.impl';

export function skipToken(sessionId: string, tokenNo: number): Promise<Result<SkipOutcome>> {
  return tokenQueueRepository.skip(sessionId, tokenNo);
}
