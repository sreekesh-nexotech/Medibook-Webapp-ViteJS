import type { Result } from '@/core/error/failure';

import type { PayoutBankAccount } from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import { hospitalsRepository } from '@/features/ops-hospitals/infrastructure/repositories/hospitals.repository.impl';

export function fetchBankAccounts(
  hospitalId: string,
): Promise<Result<readonly PayoutBankAccount[]>> {
  return hospitalsRepository.listBankAccounts(hospitalId);
}
