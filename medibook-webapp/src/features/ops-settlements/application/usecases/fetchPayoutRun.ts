import type { Result } from '@/core/error/failure';

import type { PayoutRunDetail } from '@/features/ops-settlements/domain/entities/opsSettlements.entities';
import { opsSettlementsRepository } from '@/features/ops-settlements/infrastructure/repositories/opsSettlements.repository.impl';

export function fetchPayoutRun(runId: string): Promise<Result<PayoutRunDetail>> {
  return opsSettlementsRepository.getPayoutRun(runId);
}
