import { attempt } from '@/core/error/attempt';

import type { OpsDashboardRepository } from '@/features/ops-dashboard/domain/repositories/opsDashboard.repository';
import { getOpsDashboard } from '@/features/ops-dashboard/infrastructure/data-sources/remote/opsDashboard.api';
import { toOpsDashboard } from '@/features/ops-dashboard/infrastructure/data-sources/remote/opsDashboard.response';

export const opsDashboardRepository: OpsDashboardRepository = {
  getDashboard: () => attempt(async () => toOpsDashboard(await getOpsDashboard())),
};
