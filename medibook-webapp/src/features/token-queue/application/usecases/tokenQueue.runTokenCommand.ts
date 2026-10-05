import type { Result } from '@/core/error/failure';

import type {
  QueueSession,
  TokenCommand,
} from '@/features/token-queue/domain/entities/tokenQueue.entities';
import { tokenQueueRepository } from '@/features/token-queue/infrastructure/repositories/tokenQueue.repository.impl';

export function runTokenCommand(
  sessionId: string,
  command: TokenCommand,
  tokenNo: number,
): Promise<Result<QueueSession>> {
  return tokenQueueRepository.tokenCommand(sessionId, command, tokenNo);
}
