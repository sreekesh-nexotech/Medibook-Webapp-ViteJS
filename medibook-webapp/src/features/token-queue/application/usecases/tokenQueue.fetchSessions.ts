import type { Result } from '@/core/error/failure';

import type { QueueSession } from '@/features/token-queue/domain/entities/tokenQueue.entities';
import { tokenQueueRepository } from '@/features/token-queue/infrastructure/repositories/tokenQueue.repository.impl';

export function fetchSessions(date: string): Promise<Result<readonly QueueSession[]>> {
  return tokenQueueRepository.listSessions(date);
}
