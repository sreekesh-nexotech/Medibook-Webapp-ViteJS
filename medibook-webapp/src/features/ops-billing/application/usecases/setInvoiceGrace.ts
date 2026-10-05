import type { Result } from '@/core/error/failure';

import type { BillingInvoice } from '@/features/ops-billing/domain/entities/billing.entities';
import { billingRepository } from '@/features/ops-billing/infrastructure/repositories/billing.repository.impl';

export function setInvoiceGrace(id: string, graceEndsAt: string): Promise<Result<BillingInvoice>> {
  return billingRepository.setGrace(id, graceEndsAt);
}
