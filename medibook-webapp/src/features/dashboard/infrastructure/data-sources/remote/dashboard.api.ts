import { hospitalApi } from '@/core/api/http';

import type { DashboardPeriod } from '@/features/dashboard/domain/entities/dashboard.types';
import {
  adminDashboardResponseSchema,
  receptionDashboardResponseSchema,
  type AdminDashboardResponse,
  type ReceptionDashboardResponse,
} from '@/features/dashboard/infrastructure/data-sources/remote/dashboard.response';

export async function getAdminDashboard(period: DashboardPeriod): Promise<AdminDashboardResponse> {
  const response = await hospitalApi.get('/dashboard/admin', { params: { period } });
  return adminDashboardResponseSchema.parse(response.data);
}

/** No `date` param: the backend answers for today in the hospital's own timezone. */
export async function getReceptionDashboard(): Promise<ReceptionDashboardResponse> {
  const response = await hospitalApi.get('/dashboard/reception');
  return receptionDashboardResponseSchema.parse(response.data);
}
