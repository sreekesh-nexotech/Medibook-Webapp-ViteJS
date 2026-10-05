import type { Result } from '@/core/error/failure';

import type {
  AnalyticsList,
  AnalyticsPeriodCode,
  ProviderUsage,
} from '@/features/ops-analytics/domain/entities/analytics.entities';
import { analyticsRepository } from '@/features/ops-analytics/infrastructure/repositories/analytics.repository.impl';

export function fetchProviderUsage(
  period: AnalyticsPeriodCode,
): Promise<Result<AnalyticsList<ProviderUsage>>> {
  return analyticsRepository.getProviders(period);
}
