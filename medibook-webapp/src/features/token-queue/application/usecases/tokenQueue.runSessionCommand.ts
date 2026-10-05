import type { Result } from '@/core/error/failure';

import type {
  QueueSession,
  SessionCommand,
} from '@/features/token-queue/domain/entities/tokenQueue.entities';
import { tokenQueueRepository } from '@/features/token-queue/infrastructure/repositories/tokenQueue.repository.impl';

export function runSessionCommand(
  sessionId: string,
  command: SessionCommand,
): Promise<Result<QueueSession>> {
  return tokenQueueRepository.sessionCommand(sessionId, command);
}
