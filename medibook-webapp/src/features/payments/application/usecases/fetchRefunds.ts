import type { Result } from '@/core/error/failure';

import type {
  RefundListQuery,
  RefundPage,
} from '@/features/payments/domain/entities/payments.entities';
import { paymentsRepository } from '@/features/payments/infrastructure/repositories/payments.repository.impl';

export function fetchRefunds(query: RefundListQuery): Promise<Result<RefundPage>> {
  return paymentsRepository.listRefunds(query);
}
