import type { Result } from '@/core/error/failure';

import type { TokenPolicy } from '@/features/ops-hospitals/domain/entities/hospitalSettings.entity';
import { hospitalSettingsRepository } from '@/features/ops-hospitals/infrastructure/repositories/hospitalSettings.repository.impl';

export function fetchHospitalTokenPolicy(hospitalId: string): Promise<Result<TokenPolicy>> {
  return hospitalSettingsRepository.getTokenPolicy(hospitalId);
}
