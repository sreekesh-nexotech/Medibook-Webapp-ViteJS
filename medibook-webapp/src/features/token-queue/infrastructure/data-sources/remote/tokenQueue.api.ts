import { hospitalApi } from '@/core/api/http';
import { MAX_PAGE_SIZE, paginatedSchema } from '@/core/api/pagination';

import type {
  SessionCommand,
  TokenCommand,
} from '@/features/token-queue/domain/entities/tokenQueue.entities';
import type {
  SessionSnapshotResponse,
  TokenCallResponse,
} from '@/features/token-queue/infrastructure/data-sources/remote/tokenQueue.response';
import {
  sessionSnapshotSchema,
  skipResponseSchema,
  tokenCallPageSchema,
} from '@/features/token-queue/infrastructure/data-sources/remote/tokenQueue.response';

/**
 * Doctor-session queue endpoints (`/api/v1/hospital/sessions…`). The list is
 * paginated server-side (despite `schema.yml` typing it as an object) and
 * fetched in full for the date.
 */

export const sessionPageSchema = paginatedSchema(sessionSnapshotSchema);

export async function getSessions(date: string): Promise<SessionSnapshotResponse[]> {
  const rows: SessionSnapshotResponse[] = [];
  for (let page = 1; ; page += 1) {
    const response = await hospitalApi.get('/sessions', {
      params: { date, page, page_size: MAX_PAGE_SIZE },
    });
    const data = sessionPageSchema.parse(response.data);
    rows.push(...data.results);
    if (!data.has_next) return rows;
  }
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

/**
 * `GET /hospital/sessions/{id}/calls` — the session's call history, newest
 * first (`token_management.view`). The latest page is enough for the desk.
 */
export async function getSessionCalls(sessionId: string): Promise<TokenCallResponse[]> {
  const response = await hospitalApi.get(`/sessions/${encodeURIComponent(sessionId)}/calls`, {
    params: { page: 1, page_size: MAX_PAGE_SIZE },
  });
  return tokenCallPageSchema.parse(response.data).results;
}
