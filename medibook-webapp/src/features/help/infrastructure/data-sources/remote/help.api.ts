import { hospitalApi } from '@/core/api/http';

import type {
  RaiseTicketRequest,
  TicketMessageRequest,
} from '@/features/help/infrastructure/data-sources/remote/help.request';
import type { SupportTicketResponse } from '@/features/help/infrastructure/data-sources/remote/help.response';
import {
  supportTicketDetailSchema,
  supportTicketPageSchema,
  supportTicketResponseSchema,
  ticketMessageResponseSchema,
} from '@/features/help/infrastructure/data-sources/remote/help.response';

const TICKETS_PATH = '/support/tickets';

const ticketPath = (id: string) => `${TICKETS_PATH}/${encodeURIComponent(id)}`;

/** `POST /hospital/support/tickets` — any active member; 201 with the new ticket. */
export async function postSupportTicket(body: RaiseTicketRequest): Promise<SupportTicketResponse> {
  const response = await hospitalApi.post(TICKETS_PATH, body);
  return supportTicketResponseSchema.parse(response.data);
}

/** `GET /hospital/support/tickets` — the hospital's tickets (any member). */
export async function getSupportTickets(params: Record<string, string | number>) {
  const response = await hospitalApi.get(TICKETS_PATH, { params });
  return supportTicketPageSchema.parse(response.data);
}

/** `GET /hospital/support/tickets/{id}` — one ticket with its thread. */
export async function getSupportTicket(id: string) {
  const response = await hospitalApi.get(ticketPath(id));
  return supportTicketDetailSchema.parse(response.data);
}

/** `POST /hospital/support/tickets/{id}/messages` — a reply; 201 with the message. */
export async function postTicketMessage(id: string, body: TicketMessageRequest) {
  const response = await hospitalApi.post(`${ticketPath(id)}/messages`, body);
  return ticketMessageResponseSchema.parse(response.data);
}
