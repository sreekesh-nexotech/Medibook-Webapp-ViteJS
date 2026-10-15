import type { Result } from '@/core/error/failure';

import type {
  SupportTicketPage,
  TicketListQuery,
} from '@/features/help/domain/entities/help.types';
import { helpRepository } from '@/features/help/infrastructure/repositories/help.repository.impl';

export function fetchSupportTickets(query: TicketListQuery): Promise<Result<SupportTicketPage>> {
  return helpRepository.listTickets(query);
}
