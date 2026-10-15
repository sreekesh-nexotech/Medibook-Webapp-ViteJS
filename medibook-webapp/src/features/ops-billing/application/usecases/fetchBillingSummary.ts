import type { Result } from '@/core/error/failure';

import type { BillingSummary } from '@/features/ops-billing/domain/entities/billing.entities';
import { billingRepository } from '@/features/ops-billing/infrastructure/repositories/billing.repository.impl';

export function fetchBillingSummary(): Promise<Result<BillingSummary | null>> {
  return billingRepository.getSummary();
}
