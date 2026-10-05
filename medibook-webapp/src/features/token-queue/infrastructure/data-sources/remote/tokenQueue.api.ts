import { hospitalApi } from '@/core/api/http';
import { MAX_PAGE_SIZE, paginatedSchema } from '@/core/api/pagination';

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
 * fetched in full for the date.
 */

const sessionPageSchema = paginatedSchema(sessionSnapshotSchema);

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
  const response = await hospitalApi.post(`/sessions/${sessionId}/${command}`, {});
  return sessionSnapshotSchema.parse(response.data);
}

export async function postTokenCommand(
  sessionId: string,
  command: TokenCommand,
  tokenNo: number,
): Promise<SessionSnapshotResponse> {
  const response = await hospitalApi.post(`/sessions/${sessionId}/${command}`, {
    token_no: tokenNo,
  });
  return sessionSnapshotSchema.parse(response.data);
}

export async function postSkip(sessionId: string, tokenNo: number) {
  const response = await hospitalApi.post(`/sessions/${sessionId}/skip`, { token_no: tokenNo });
  return skipResponseSchema.parse(response.data);
}
