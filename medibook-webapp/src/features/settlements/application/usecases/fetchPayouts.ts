import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  Payout,
  PayoutListQuery,
} from '@/features/settlements/domain/entities/settlements.entities';
import { settlementsRepository } from '@/features/settlements/infrastructure/repositories/settlements.repository.impl';

export function fetchPayouts(query: PayoutListQuery): Promise<Result<Page<Payout>>> {
  return settlementsRepository.listPayouts(query);
}
