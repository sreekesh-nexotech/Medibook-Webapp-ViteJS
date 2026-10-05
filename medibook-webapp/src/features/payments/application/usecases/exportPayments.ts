import type { Result } from '@/core/error/failure';

import type { PaymentFilters } from '@/features/payments/domain/entities/payments.entities';
import { paymentsRepository } from '@/features/payments/infrastructure/repositories/payments.repository.impl';

/** The server-built CSV of every payment line matching `filters`. */
export function exportPayments(filters: PaymentFilters): Promise<Result<string>> {
  return paymentsRepository.exportCsv(filters);
}
