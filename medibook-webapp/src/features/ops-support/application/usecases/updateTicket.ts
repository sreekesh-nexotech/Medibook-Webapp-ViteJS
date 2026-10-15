import type { Result } from '@/core/error/failure';

import type {
  SupportTicketDetail,
  TicketChanges,
} from '@/features/ops-support/domain/entities/support.entities';
import { supportRepository } from '@/features/ops-support/infrastructure/repositories/support.repository.impl';

export function updateTicket(
  id: string,
  changes: TicketChanges,
  version: number,
): Promise<Result<SupportTicketDetail>> {
  return supportRepository.updateTicket(id, changes, version);
}
