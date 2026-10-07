import type { Result } from '@/core/error/failure';

import type {
  Payout,
  PayoutCommand,
} from '@/features/ops-settlements/domain/entities/opsSettlements.entities';
import { opsSettlementsRepository } from '@/features/ops-settlements/infrastructure/repositories/opsSettlements.repository.impl';

export function commandPayout(
  payoutId: string,
  command: PayoutCommand,
  reason: string,
  idempotencyKey: string,
): Promise<Result<Payout>> {
  return opsSettlementsRepository.commandPayout(payoutId, command, reason, idempotencyKey);
}
