import type { Result } from '@/core/error/failure';

import type { OpsDashboard } from '@/features/ops-dashboard/domain/entities/opsDashboard.entities';
import { opsDashboardRepository } from '@/features/ops-dashboard/infrastructure/repositories/opsDashboard.repository.impl';

export function fetchOpsDashboard(): Promise<Result<OpsDashboard>> {
  return opsDashboardRepository.getDashboard();
}
