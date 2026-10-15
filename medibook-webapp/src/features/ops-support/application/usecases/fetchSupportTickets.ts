import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  SupportTicket,
  TicketListParams,
} from '@/features/ops-support/domain/entities/support.entities';
import { supportRepository } from '@/features/ops-support/infrastructure/repositories/support.repository.impl';

export function fetchSupportTickets(
  params: TicketListParams,
): Promise<Result<Page<SupportTicket>>> {
  return supportRepository.listTickets(params);
}
