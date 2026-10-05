import type { Result } from '@/core/error/failure';

import type { BillingInvoice } from '@/features/ops-billing/domain/entities/billing.entities';
import { billingRepository } from '@/features/ops-billing/infrastructure/repositories/billing.repository.impl';

export function voidInvoice(id: string, reason: string): Promise<Result<BillingInvoice>> {
  return billingRepository.voidInvoice(id, reason);
}
