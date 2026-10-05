import type { QueueSession } from '@/features/token-queue/domain/entities/tokenQueue.entities';
import { tokenQueueRepository } from '@/features/token-queue/infrastructure/repositories/tokenQueue.repository.impl';

/** A session snapshot pushed over the queue socket, validated; `null` when unreadable. */
export function readPushedSession(data: unknown): QueueSession | null {
  return tokenQueueRepository.readPushedSession(data);
}
