import { hospitalApi } from '@/core/api/http';

import type { RaiseTicketRequest } from '@/features/help/infrastructure/data-sources/remote/help.request';
import type { SupportTicketResponse } from '@/features/help/infrastructure/data-sources/remote/help.response';
import { supportTicketResponseSchema } from '@/features/help/infrastructure/data-sources/remote/help.response';

/** `POST /hospital/support/tickets` — any active member; 201 with the new ticket. */
export async function postSupportTicket(body: RaiseTicketRequest): Promise<SupportTicketResponse> {
  const response = await hospitalApi.post('/support/tickets', body);
  return supportTicketResponseSchema.parse(response.data);
}
