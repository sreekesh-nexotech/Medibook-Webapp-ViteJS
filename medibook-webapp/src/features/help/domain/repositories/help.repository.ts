import type { Result } from '@/core/error/failure';

import type {
  NewSupportTicket,
  NewTicketMessage,
  SupportTicket,
  SupportTicketDetail,
  SupportTicketMessage,
  SupportTicketPage,
  TicketListQuery,
} from '@/features/help/domain/entities/help.types';

/** Help & Support on the hospital surface. */
export interface HelpRepository {
  /** Raise a ticket with the Medibook team; returns it with its ticket number. */
  raiseTicket(input: NewSupportTicket): Promise<Result<SupportTicket>>;
  /** The hospital's tickets, newest first. */
  listTickets(query: TicketListQuery): Promise<Result<SupportTicketPage>>;
  /** One ticket with its thread. */
  getTicket(id: string): Promise<Result<SupportTicketDetail>>;
  /** Reply on a ticket's thread. */
  addMessage(id: string, input: NewTicketMessage): Promise<Result<SupportTicketMessage>>;
}
