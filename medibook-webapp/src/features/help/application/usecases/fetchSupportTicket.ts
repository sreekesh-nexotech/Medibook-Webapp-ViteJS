import type { Result } from '@/core/error/failure';

import type { SupportTicketDetail } from '@/features/help/domain/entities/help.types';
import { helpRepository } from '@/features/help/infrastructure/repositories/help.repository.impl';

export function fetchSupportTicket(id: string): Promise<Result<SupportTicketDetail>> {
  return helpRepository.getTicket(id);
}
