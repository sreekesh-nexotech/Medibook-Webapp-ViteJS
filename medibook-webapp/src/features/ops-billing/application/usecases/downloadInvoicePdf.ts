import type { Result } from '@/core/error/failure';

import type { BillingFile } from '@/features/ops-billing/domain/entities/billing.entities';
import { billingRepository } from '@/features/ops-billing/infrastructure/repositories/billing.repository.impl';

export function downloadInvoicePdf(id: string, invoiceNo: string): Promise<Result<BillingFile>> {
  return billingRepository.getInvoicePdf(id, invoiceNo);
}
