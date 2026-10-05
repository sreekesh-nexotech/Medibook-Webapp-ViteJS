import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  ConfigChangeParams,
  ConfigChangeRecord,
} from '@/features/ops-compliance/domain/entities/compliance.entities';
import { complianceRepository } from '@/features/ops-compliance/infrastructure/repositories/compliance.repository.impl';

export function fetchComplianceConfigChanges(
  params: ConfigChangeParams,
): Promise<Result<Page<ConfigChangeRecord>>> {
  return complianceRepository.listConfigChanges(params);
}
