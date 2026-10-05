import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  BillingInvoice,
  InvoiceListParams,
} from '@/features/ops-billing/domain/entities/billing.entities';
import { billingRepository } from '@/features/ops-billing/infrastructure/repositories/billing.repository.impl';

export function fetchInvoices(params: InvoiceListParams): Promise<Result<Page<BillingInvoice>>> {
  return billingRepository.listInvoices(params);
}
