import type { Result } from '@/core/error/failure';

import type {
  PaymentExportFile,
  PaymentExportFormat,
  PaymentFilters,
} from '@/features/payments/domain/entities/payments.entities';
import { paymentsRepository } from '@/features/payments/infrastructure/repositories/payments.repository.impl';

/** The server-built CSV, Excel or PDF of every payment line matching `filters`. */
export function exportPayments(
  filters: PaymentFilters,
  format: PaymentExportFormat,
): Promise<Result<PaymentExportFile>> {
  return paymentsRepository.exportPayments(filters, format);
}
