import { platformApi } from '@/core/api/http';

import { opsDashboardResponseSchema } from '@/features/ops-dashboard/infrastructure/data-sources/remote/opsDashboard.response';

/** `GET /platform/dashboard` — KPIs, computed alerts and the five latest onboarding cases. */
export async function getOpsDashboard() {
  const response = await platformApi.get('/dashboard');
  return opsDashboardResponseSchema.parse(response.data);
}
