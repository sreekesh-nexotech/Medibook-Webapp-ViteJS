import type { Result } from '@/core/error/failure';

import type { TicketStatus } from '@/features/ops-support/domain/entities/support.entities';
import { supportRepository } from '@/features/ops-support/infrastructure/repositories/support.repository.impl';

export function countSupportTickets(statuses: readonly TicketStatus[]): Promise<Result<number>> {
  return supportRepository.countTickets(statuses);
}
