import type { Result } from '@/core/error/failure';

import type { BillingInvoiceDetail } from '@/features/settlements/domain/entities/billing.entities';
import { billingRepository } from '@/features/settlements/infrastructure/repositories/billing.repository.impl';

export function fetchInvoice(invoiceId: string): Promise<Result<BillingInvoiceDetail>> {
  return billingRepository.getInvoice(invoiceId);
}
