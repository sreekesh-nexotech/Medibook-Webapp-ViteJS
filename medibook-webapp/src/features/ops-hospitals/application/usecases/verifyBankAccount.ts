import type { Result } from '@/core/error/failure';

import type { PayoutBankAccount } from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import { hospitalsRepository } from '@/features/ops-hospitals/infrastructure/repositories/hospitals.repository.impl';

export function verifyBankAccount(
  hospitalId: string,
  accountId: string,
  version: number,
): Promise<Result<PayoutBankAccount>> {
  return hospitalsRepository.verifyBankAccount(hospitalId, accountId, version);
}
