import type { Result } from '@/core/error/failure';

import type {
  BillingInvoice,
  MarkPaidInput,
} from '@/features/ops-billing/domain/entities/billing.entities';
import { billingRepository } from '@/features/ops-billing/infrastructure/repositories/billing.repository.impl';

export function markInvoicePaid(
  id: string,
  input: MarkPaidInput,
  idempotencyKey: string,
): Promise<Result<BillingInvoice>> {
  return billingRepository.markPaid(id, input, idempotencyKey);
}
