import type { Result } from '@/core/error/failure';

import type {
  AdminDashboard,
  DashboardPeriod,
} from '@/features/dashboard/domain/entities/dashboard.types';
import { dashboardRepository } from '@/features/dashboard/infrastructure/repositories/dashboard.repository.impl';

export function fetchAdminDashboard(period: DashboardPeriod): Promise<Result<AdminDashboard>> {
  return dashboardRepository.getAdminDashboard(period);
}
