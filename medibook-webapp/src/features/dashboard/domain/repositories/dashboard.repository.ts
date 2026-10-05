import type { Result } from '@/core/error/failure';

import type {
  AdminDashboard,
  DashboardPeriod,
  ReceptionDashboard,
} from '@/features/dashboard/domain/entities/dashboard.types';

/** The hospital's two dashboards. */
export interface DashboardRepository {
  getAdminDashboard(period: DashboardPeriod): Promise<Result<AdminDashboard>>;
  /** Today in the hospital's timezone. */
  getReceptionDashboard(): Promise<Result<ReceptionDashboard>>;
}
