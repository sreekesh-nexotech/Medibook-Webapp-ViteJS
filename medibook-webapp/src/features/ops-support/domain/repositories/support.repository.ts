import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  SupportTicket,
  SupportTicketDetail,
  TicketChanges,
  TicketListParams,
  TicketMessage,
  TicketReply,
} from '@/features/ops-support/domain/entities/support.entities';

/** The ops console's support inbox. */
export interface SupportRepository {
  listTickets(params: TicketListParams): Promise<Result<Page<SupportTicket>>>;
  /** How many tickets have one of `statuses`. */
  countTickets(statuses: readonly string[]): Promise<Result<number>>;
  getTicket(id: string): Promise<Result<SupportTicketDetail>>;
  /** Change status, priority or assignee; refused when `version` is stale. */
  updateTicket(
    id: string,
    changes: TicketChanges,
    version: number,
  ): Promise<Result<SupportTicketDetail>>;
  /** Reply to the requester (emailed) or add an internal note. */
  replyToTicket(id: string, reply: TicketReply): Promise<Result<TicketMessage>>;
  /** A short-lived download link for a file attached to a ticket. */
  attachmentUrl(fileId: string): Promise<Result<string>>;
}
