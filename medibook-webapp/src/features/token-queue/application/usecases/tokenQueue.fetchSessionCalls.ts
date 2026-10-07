import type { Result } from '@/core/error/failure';

import type { TokenCall } from '@/features/token-queue/domain/entities/tokenQueue.entities';
import { tokenQueueRepository } from '@/features/token-queue/infrastructure/repositories/tokenQueue.repository.impl';

export function fetchSessionCalls(sessionId: string): Promise<Result<readonly TokenCall[]>> {
  return tokenQueueRepository.listCalls(sessionId);
}
