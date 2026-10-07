import { hospitalApi } from '@/core/api/http';
import { fetchAllPages, paginatedSchema } from '@/core/api/pagination';

import type {
  SessionCommand,
  TokenCommand,
} from '@/features/token-queue/domain/entities/tokenQueue.entities';
import type { SessionSnapshotResponse } from '@/features/token-queue/infrastructure/data-sources/remote/tokenQueue.response';
import {
  sessionSnapshotSchema,
  skipResponseSchema,
} from '@/features/token-queue/infrastructure/data-sources/remote/tokenQueue.response';

/**
 * Doctor-session queue endpoints (`/api/v1/hospital/sessions…`). The list is
 * paginated server-side (despite `schema.yml` typing it as an object) and
 * fetched in full for the date, with a hard stop (PERF-03): a list past 50
 * pages fails with a message instead of looping on.
 */

export const sessionPageSchema = paginatedSchema(sessionSnapshotSchema);

export async function getSessions(date: string): Promise<SessionSnapshotResponse[]> {
  return fetchAllPages(async (pageParams) => {
    const response = await hospitalApi.get('/sessions', { params: { date, ...pageParams } });
    return sessionPageSchema.parse(response.data);
  });
}

export async function postSessionCommand(
  sessionId: string,
  command: SessionCommand,
): Promise<SessionSnapshotResponse> {
  const response = await hospitalApi.post(
    `/sessions/${encodeURIComponent(sessionId)}/${encodeURIComponent(command)}`,
    {},
  );
  return sessionSnapshotSchema.parse(response.data);
}

export async function postTokenCommand(
  sessionId: string,
  command: TokenCommand,
  tokenNo: number,
): Promise<SessionSnapshotResponse> {
  const response = await hospitalApi.post(
    `/sessions/${encodeURIComponent(sessionId)}/${encodeURIComponent(command)}`,
    {
      token_no: tokenNo,
    },
  );
  return sessionSnapshotSchema.parse(response.data);
}

export async function postSkip(sessionId: string, tokenNo: number) {
  const response = await hospitalApi.post(`/sessions/${encodeURIComponent(sessionId)}/skip`, {
    token_no: tokenNo,
  });
  return skipResponseSchema.parse(response.data);
}
