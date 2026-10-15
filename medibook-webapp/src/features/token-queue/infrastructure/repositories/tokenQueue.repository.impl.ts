import { attempt } from '@/core/error/attempt';

import type { TokenQueueRepository } from '@/features/token-queue/domain/repositories/tokenQueue.repository';
import {
  getSessionCalls,
  getSessions,
  postSessionCommand,
  postSkip,
  postTokenCommand,
} from '@/features/token-queue/infrastructure/data-sources/remote/tokenQueue.api';
import {
  sessionSnapshotSchema,
  toQueueSession,
  toSkipOutcome,
  toTokenCall,
} from '@/features/token-queue/infrastructure/data-sources/remote/tokenQueue.response';

export const tokenQueueRepository: TokenQueueRepository = {
  listSessions: (date) => attempt(async () => (await getSessions(date)).map(toQueueSession)),
  sessionCommand: (sessionId, command) =>
    attempt(async () => toQueueSession(await postSessionCommand(sessionId, command))),
  tokenCommand: (sessionId, command, tokenNo) =>
    attempt(async () => toQueueSession(await postTokenCommand(sessionId, command, tokenNo))),
  skip: (sessionId, tokenNo) =>
    attempt(async () => toSkipOutcome(await postSkip(sessionId, tokenNo))),
  listCalls: (sessionId) =>
    attempt(async () => (await getSessionCalls(sessionId)).map(toTokenCall)),
  readPushedSession: (data) => {
    const parsed = sessionSnapshotSchema.safeParse(data);
    return parsed.success ? toQueueSession(parsed.data) : null;
  },
};
