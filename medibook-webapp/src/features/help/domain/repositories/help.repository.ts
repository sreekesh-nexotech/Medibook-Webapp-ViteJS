import type { Result } from '@/core/error/failure';

import type { NewSupportTicket, SupportTicket } from '@/features/help/domain/entities/help.types';

/** Help & Support on the hospital surface. */
export interface HelpRepository {
  /** Raise a ticket with the Medibook team; returns it with its ticket number. */
  raiseTicket(input: NewSupportTicket): Promise<Result<SupportTicket>>;
}
