import type { Result } from '@/core/error/failure';

import type {
  AnalyticsList,
  AnalyticsPeriodCode,
  ApiErrorRow,
} from '@/features/ops-analytics/domain/entities/analytics.entities';
import { analyticsRepository } from '@/features/ops-analytics/infrastructure/repositories/analytics.repository.impl';

export function fetchApiErrors(
  period: AnalyticsPeriodCode,
): Promise<Result<AnalyticsList<ApiErrorRow>>> {
  return analyticsRepository.getApiErrors(period);
}
