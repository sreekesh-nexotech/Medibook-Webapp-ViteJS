import type { Result } from '@/core/error/failure';

import type {
  AnalyticsList,
  AnalyticsPeriodCode,
  DepartmentShare,
} from '@/features/ops-analytics/domain/entities/analytics.entities';
import { analyticsRepository } from '@/features/ops-analytics/infrastructure/repositories/analytics.repository.impl';

export function fetchDepartmentsSplit(
  period: AnalyticsPeriodCode,
): Promise<Result<AnalyticsList<DepartmentShare>>> {
  return analyticsRepository.getDepartmentsSplit(period);
}
