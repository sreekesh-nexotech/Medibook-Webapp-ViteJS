import type { Result } from '@/core/error/failure';

import type {
  AnalyticsList,
  AnalyticsPeriodCode,
  TopHospital,
} from '@/features/ops-analytics/domain/entities/analytics.entities';
import { analyticsRepository } from '@/features/ops-analytics/infrastructure/repositories/analytics.repository.impl';

export function fetchTopHospitals(
  period: AnalyticsPeriodCode,
): Promise<Result<AnalyticsList<TopHospital>>> {
  return analyticsRepository.getTopHospitals(period);
}
