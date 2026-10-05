import type { Result } from '@/core/error/failure';

import type { PayoutRun } from '@/features/ops-settlements/domain/entities/opsSettlements.entities';
import { opsSettlementsRepository } from '@/features/ops-settlements/infrastructure/repositories/opsSettlements.repository.impl';

export function fetchPayoutRuns(): Promise<Result<readonly PayoutRun[]>> {
  return opsSettlementsRepository.listPayoutRuns();
}
