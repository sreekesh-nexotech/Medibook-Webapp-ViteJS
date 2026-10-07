import type { Result } from '@/core/error/failure';

import type {
  TokenPolicy,
  TokenPolicyChange,
} from '@/features/ops-hospitals/domain/entities/hospitalSettings.entity';
import { hospitalSettingsRepository } from '@/features/ops-hospitals/infrastructure/repositories/hospitalSettings.repository.impl';

export function updateHospitalTokenPolicy(
  hospitalId: string,
  change: TokenPolicyChange,
  version: number,
): Promise<Result<TokenPolicy>> {
  return hospitalSettingsRepository.updateTokenPolicy(hospitalId, change, version);
}
