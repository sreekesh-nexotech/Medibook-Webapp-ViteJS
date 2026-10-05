import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type { BillingInvoice } from '@/features/settlements/domain/entities/billing.entities';
import { billingRepository } from '@/features/settlements/infrastructure/repositories/billing.repository.impl';

export function fetchInvoices(
  page: number,
  pageSize: number,
): Promise<Result<Page<BillingInvoice>>> {
  return billingRepository.listInvoices(page, pageSize);
}
