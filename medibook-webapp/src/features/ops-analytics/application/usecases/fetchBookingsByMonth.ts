import type { Result } from '@/core/error/failure';

import type {
  AnalyticsList,
  AnalyticsPeriodCode,
  MonthlyBookings,
} from '@/features/ops-analytics/domain/entities/analytics.entities';
import { analyticsRepository } from '@/features/ops-analytics/infrastructure/repositories/analytics.repository.impl';

export function fetchBookingsByMonth(
  period: AnalyticsPeriodCode,
): Promise<Result<AnalyticsList<MonthlyBookings>>> {
  return analyticsRepository.getBookingsByMonth(period);
}
