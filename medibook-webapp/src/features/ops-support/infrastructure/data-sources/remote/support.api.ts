import { ifMatch } from '@/core/api/headers';
import { platformApi } from '@/core/api/http';

import type {
  TicketChanges,
  TicketListQuery,
  TicketReply,
} from '@/features/ops-support/domain/entities/support.entities';
import {
  toTicketListParams,
  toTicketPatchBody,
  toTicketReplyBody,
  type TicketListQueryDto,
  type TicketMessageRequest,
  type TicketUpdateRequest,
} from '@/features/ops-support/infrastructure/data-sources/remote/support.request';
import type {
  TicketDetailResponse,
  TicketMessageResponse,
  TicketPageResponse,
} from '@/features/ops-support/infrastructure/data-sources/remote/support.response';
import {
  ticketDetailResponseSchema,
  ticketMessageResponseSchema,
  ticketPageResponseSchema,
} from '@/features/ops-support/infrastructure/data-sources/remote/support.response';

const TICKETS_PATH = '/support/tickets';
const ticketPath = (id: string): string => `${TICKETS_PATH}/${encodeURIComponent(id)}`;

/** `GET /platform/support/tickets` (`support.view`). */
export async function getTickets(
  query: TicketListQuery | TicketListQueryDto | Record<string, unknown>,
): Promise<TicketPageResponse> {
  const params = 'statuses' in query ? toTicketListParams(query as TicketListQuery) : query;
  const response = await platformApi.get(TICKETS_PATH, { params });
  return ticketPageResponseSchema.parse(response.data);
}

/** `GET /platform/support/tickets/{id}` — with the thread, internal notes included. */
export async function getTicket(id: string): Promise<TicketDetailResponse> {
  const response = await platformApi.get(ticketPath(id));
  return ticketDetailResponseSchema.parse(response.data);
}

/**
 * `PATCH /platform/support/tickets/{id}` (`support.edit`). `If-Match` is
 * required by B9 (L-25); a stale version is a `409 CONFLICT_VERSION`, a move
 * the ticket cannot make a `409 STATE_CONFLICT`.
 */
export async function patchTicket(
  id: string,
  changes: TicketChanges | TicketUpdateRequest,
  version: number,
): Promise<TicketDetailResponse> {
  const body = 'assigned_to_id' in changes ? changes : toTicketPatchBody(changes as TicketChanges);
  const response = await platformApi.patch(ticketPath(id), body, {
    headers: ifMatch(version),
  });
  return ticketDetailResponseSchema.parse(response.data);
}

/** `POST /platform/support/tickets/{id}/messages` (`support.add`); closed → 409. */
export async function postTicketMessage(
  id: string,
  reply: TicketReply | TicketMessageRequest,
): Promise<TicketMessageResponse> {
  const body =
    'is_internal' in reply && !('attachmentFileIds' in reply)
      ? reply
      : toTicketReplyBody(reply as TicketReply);
  const response = await platformApi.post(`${ticketPath(id)}/messages`, body);
  return ticketMessageResponseSchema.parse(response.data);
}
