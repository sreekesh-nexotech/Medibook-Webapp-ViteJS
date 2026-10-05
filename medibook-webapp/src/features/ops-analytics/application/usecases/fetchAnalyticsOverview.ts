import type { Result } from '@/core/error/failure';

import type {
  AnalyticsOverview,
  AnalyticsPeriodCode,
} from '@/features/ops-analytics/domain/entities/analytics.entities';
import { analyticsRepository } from '@/features/ops-analytics/infrastructure/repositories/analytics.repository.impl';

export function fetchAnalyticsOverview(
  period: AnalyticsPeriodCode,
): Promise<Result<AnalyticsOverview>> {
  return analyticsRepository.getOverview(period);
}
