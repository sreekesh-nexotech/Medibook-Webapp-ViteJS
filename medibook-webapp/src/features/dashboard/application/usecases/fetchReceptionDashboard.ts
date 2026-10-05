import type { Result } from '@/core/error/failure';

import type { ReceptionDashboard } from '@/features/dashboard/domain/entities/dashboard.types';
import { dashboardRepository } from '@/features/dashboard/infrastructure/repositories/dashboard.repository.impl';

export function fetchReceptionDashboard(): Promise<Result<ReceptionDashboard>> {
  return dashboardRepository.getReceptionDashboard();
}
