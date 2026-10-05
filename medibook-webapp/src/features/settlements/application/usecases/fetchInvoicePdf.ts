import type { Result } from '@/core/error/failure';

import { billingRepository } from '@/features/settlements/infrastructure/repositories/billing.repository.impl';

export function fetchInvoicePdf(invoiceId: string): Promise<Result<Blob>> {
  return billingRepository.getInvoicePdf(invoiceId);
}
