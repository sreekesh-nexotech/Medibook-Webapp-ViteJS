import type { Result } from '@/core/error/failure';

import type {
  FeeQuote,
  QuoteInput,
} from '@/features/appointments/domain/entities/appointments.entities';
import { appointmentsRepository } from '@/features/appointments/infrastructure/repositories/appointments.repository.impl';

export function quoteWalkIn(input: QuoteInput): Promise<Result<FeeQuote | null>> {
  return appointmentsRepository.quote(input);
}
