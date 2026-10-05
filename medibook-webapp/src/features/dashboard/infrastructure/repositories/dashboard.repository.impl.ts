import { attempt } from '@/core/error/attempt';

import type { DashboardRepository } from '@/features/dashboard/domain/repositories/dashboard.repository';
import {
  getAdminDashboard,
  getReceptionDashboard,
} from '@/features/dashboard/infrastructure/data-sources/remote/dashboard.api';
import {
  toAdminDashboard,
  toReceptionDashboard,
} from '@/features/dashboard/infrastructure/data-sources/remote/dashboard.response';

export const dashboardRepository: DashboardRepository = {
  getAdminDashboard: (period) =>
    attempt(async () => toAdminDashboard(await getAdminDashboard(period))),

  getReceptionDashboard: () =>
    attempt(async () => toReceptionDashboard(await getReceptionDashboard())),
};
