import type { Result } from '@/core/error/failure';

import type { NewSupportTicket, SupportTicket } from '@/features/help/domain/entities/help.types';
import { helpRepository } from '@/features/help/infrastructure/repositories/help.repository.impl';

export function raiseSupportTicket(input: NewSupportTicket): Promise<Result<SupportTicket>> {
  return helpRepository.raiseTicket(input);
}
