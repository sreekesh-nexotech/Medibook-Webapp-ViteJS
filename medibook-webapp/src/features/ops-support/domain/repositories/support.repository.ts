import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  SupportTicket,
  SupportTicketDetail,
  TicketChanges,
  TicketListParams,
  TicketListQuery,
  TicketMessage,
  TicketReply,
} from '@/features/ops-support/domain/entities/support.entities';

/** The platform support desk (`support.view` / `.add` / `.edit`). */
export interface SupportRepository {
  listTickets(query: TicketListQuery | TicketListParams): Promise<Result<Page<SupportTicket>>>;
  /** How many tickets have one of `statuses`. */
  countTickets(statuses: readonly string[]): Promise<Result<number>>;
  getTicket(id: string): Promise<Result<SupportTicketDetail>>;
  /** Status / priority / assignee, guarded by the ticket's version. */
  updateTicket(
    id: string,
    changes: TicketChanges,
    version: number,
  ): Promise<Result<SupportTicketDetail>>;
  reply(id: string, reply: TicketReply): Promise<Result<TicketMessage>>;
  /** Reply to the requester (emailed) or add an internal note. */
  replyToTicket(id: string, reply: TicketReply): Promise<Result<TicketMessage>>;
  /** A short-lived download link for a file attached to a ticket. */
  attachmentUrl(fileId: string): Promise<Result<string>>;
}
