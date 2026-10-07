import type { Result } from '@/core/error/failure';

import type { PaymentRefund } from '@/features/payments/domain/entities/payments.entities';
import { paymentsRepository } from '@/features/payments/infrastructure/repositories/payments.repository.impl';

export function fetchRefundsInWindow(
  dateFrom: string,
  dateTo: string,
): Promise<Result<readonly PaymentRefund[]>> {
  return paymentsRepository.listAllRefunds(dateFrom, dateTo);
}
