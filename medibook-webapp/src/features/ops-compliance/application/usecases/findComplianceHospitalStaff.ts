import type { Result } from '@/core/error/failure';

import type { StaffDirectoryEntry } from '@/features/ops-compliance/domain/entities/compliance.entities';
import { complianceRepository } from '@/features/ops-compliance/infrastructure/repositories/compliance.repository.impl';

export function findComplianceHospitalStaff(q: string): Promise<Result<StaffDirectoryEntry[]>> {
  return complianceRepository.findHospitalStaff(q);
}
