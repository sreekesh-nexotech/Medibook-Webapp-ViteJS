import type { Result } from '@/core/error/failure';

import type { SupportTicketDetail } from '@/features/ops-support/domain/entities/support.entities';
import { supportRepository } from '@/features/ops-support/infrastructure/repositories/support.repository.impl';

export function fetchSupportTicket(id: string): Promise<Result<SupportTicketDetail>> {
  return supportRepository.getTicket(id);
}
