import { ifMatch } from '@/core/api/headers';
import { platformApi } from '@/core/api/http';

import type {
  TicketListQuery,
  TicketMessageRequest,
  TicketUpdateRequest,
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

const TICKETS = '/support/tickets';

/** `GET /platform/support/tickets` (support.view). */
export async function getTickets(query: TicketListQuery): Promise<TicketPageResponse> {
  const response = await platformApi.get(TICKETS, { params: query });
  return ticketPageResponseSchema.parse(response.data);
}

/** `GET /platform/support/tickets/{id}` — with the thread, internal notes included. */
export async function getTicket(id: string): Promise<TicketDetailResponse> {
  const response = await platformApi.get(`${TICKETS}/${encodeURIComponent(id)}`);
  return ticketDetailResponseSchema.parse(response.data);
}

/** `PATCH /platform/support/tickets/{id}` (support.edit), pinned to the version on screen. */
export async function patchTicket(
  id: string,
  body: TicketUpdateRequest,
  version: number,
): Promise<TicketDetailResponse> {
  const response = await platformApi.patch(`${TICKETS}/${encodeURIComponent(id)}`, body, {
    headers: ifMatch(version),
  });
  return ticketDetailResponseSchema.parse(response.data);
}

/** `POST /platform/support/tickets/{id}/messages` (support.add). */
export async function postTicketMessage(
  id: string,
  body: TicketMessageRequest,
): Promise<TicketMessageResponse> {
  const response = await platformApi.post(`${TICKETS}/${encodeURIComponent(id)}/messages`, body);
  return ticketMessageResponseSchema.parse(response.data);
}
