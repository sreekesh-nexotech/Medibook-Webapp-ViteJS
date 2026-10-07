import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  DunningEvent,
  DunningListParams,
} from '@/features/ops-billing/domain/entities/billing.entities';
import { billingRepository } from '@/features/ops-billing/infrastructure/repositories/billing.repository.impl';

export function fetchDunningEvents(params: DunningListParams): Promise<Result<Page<DunningEvent>>> {
  return billingRepository.listDunning(params);
}
