import type { Result } from '@/core/error/failure';

import type { OpsDashboard } from '@/features/ops-dashboard/domain/entities/opsDashboard.entities';

/** The platform-wide dashboard — read-only. */
export interface OpsDashboardRepository {
  getDashboard(): Promise<Result<OpsDashboard>>;
}
