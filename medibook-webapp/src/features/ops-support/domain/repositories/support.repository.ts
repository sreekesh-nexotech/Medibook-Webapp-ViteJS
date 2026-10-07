import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  SupportTicket,
  SupportTicketDetail,
  TicketChanges,
  TicketListQuery,
  TicketMessage,
  TicketReply,
} from '@/features/ops-support/domain/entities/support.entities';

/** The platform support desk (`support.view` / `.add` / `.edit`). */
export interface SupportRepository {
  listTickets(query: TicketListQuery): Promise<Result<Page<SupportTicket>>>;
  getTicket(id: string): Promise<Result<SupportTicketDetail>>;
  /** Status / priority / assignee, guarded by the ticket's version. */
  updateTicket(
    id: string,
    changes: TicketChanges,
    version: number,
  ): Promise<Result<SupportTicketDetail>>;
  reply(id: string, reply: TicketReply): Promise<Result<TicketMessage>>;
}
