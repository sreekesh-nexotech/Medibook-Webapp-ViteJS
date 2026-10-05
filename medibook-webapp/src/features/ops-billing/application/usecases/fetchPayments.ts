import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  PaymentListParams,
  SubscriptionPayment,
} from '@/features/ops-billing/domain/entities/billing.entities';
import { billingRepository } from '@/features/ops-billing/infrastructure/repositories/billing.repository.impl';

export function fetchPayments(
  params: PaymentListParams,
): Promise<Result<Page<SubscriptionPayment>>> {
  return billingRepository.listPayments(params);
}
