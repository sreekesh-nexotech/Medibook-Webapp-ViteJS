import type { Result } from '@/core/error/failure';

import type {
  QueueSession,
  SessionCommand,
  SkipOutcome,
  TokenCommand,
} from '@/features/token-queue/domain/entities/tokenQueue.entities';

/** The live token queue: today's sessions and the desk's queue commands. */
export interface TokenQueueRepository {
  /** Every session on a hospital-local date. */
  listSessions(date: string): Promise<Result<readonly QueueSession[]>>;
  sessionCommand(sessionId: string, command: SessionCommand): Promise<Result<QueueSession>>;
  tokenCommand(
    sessionId: string,
    command: TokenCommand,
    tokenNo: number,
  ): Promise<Result<QueueSession>>;
  skip(sessionId: string, tokenNo: number): Promise<Result<SkipOutcome>>;
  /** A session snapshot pushed over the queue WebSocket, or `null` when unreadable. */
  readPushedSession(data: unknown): QueueSession | null;
}
