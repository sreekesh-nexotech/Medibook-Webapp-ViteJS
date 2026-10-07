import type { Result } from '@/core/error/failure';

import type {
  HelpFaq,
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
  /**
   * The platform's FAQ feed for hospital staff, in display order; empty when
   * the backend has none (or predates the feed).
   */
  listFaqs(): Promise<Result<readonly HelpFaq[]>>;
  /** Reply on a ticket's thread. */
  addMessage(id: string, input: NewTicketMessage): Promise<Result<SupportTicketMessage>>;
}
