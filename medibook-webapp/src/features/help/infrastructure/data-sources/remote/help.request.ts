import { z } from 'zod';

import type { NewSupportTicket } from '@/features/help/domain/entities/help.types';
import {
  SUPPORT_TICKET_CATEGORIES,
  TICKET_DESCRIPTION_MAX,
  TICKET_SUBJECT_MAX,
} from '@/features/help/domain/entities/help.types';

/**
 * `POST /hospital/support/tickets` body (`TicketCreateRequest`). `priority`
 * and `attachment_file_ids` are optional and not offered by the form — the
 * backend defaults priority to `normal`.
 */
export const raiseTicketRequestSchema = z.object({
  category: z.enum(SUPPORT_TICKET_CATEGORIES),
  subject: z.string().min(1).max(TICKET_SUBJECT_MAX),
  description: z.string().min(1).max(TICKET_DESCRIPTION_MAX),
});

export type RaiseTicketRequest = z.infer<typeof raiseTicketRequestSchema>;

export function toRaiseTicketRequest(input: NewSupportTicket): RaiseTicketRequest {
  return {
    category: input.category,
    subject: input.subject.trim(),
    description: input.description.trim(),
  };
}
