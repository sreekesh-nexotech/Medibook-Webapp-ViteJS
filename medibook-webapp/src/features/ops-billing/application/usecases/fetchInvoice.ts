import type { Result } from '@/core/error/failure';

import type { BillingInvoiceDetail } from '@/features/ops-billing/domain/entities/billing.entities';
import { billingRepository } from '@/features/ops-billing/infrastructure/repositories/billing.repository.impl';

export function fetchInvoice(id: string): Promise<Result<BillingInvoiceDetail>> {
  return billingRepository.getInvoice(id);
}
