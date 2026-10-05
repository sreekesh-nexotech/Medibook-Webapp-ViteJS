import type { Result } from '@/core/error/failure';

import type {
  AnalyticsList,
  AnalyticsOverview,
  AnalyticsPeriodCode,
  ApiErrorRow,
  DepartmentShare,
  MonthlyBookings,
  ProviderUsage,
  TopHospital,
} from '@/features/ops-analytics/domain/entities/analytics.entities';

/** Platform usage analytics (permission `analytics.view`), platform-wide. */
export interface AnalyticsRepository {
  getOverview(period: AnalyticsPeriodCode): Promise<Result<AnalyticsOverview>>;
  getBookingsByMonth(period: AnalyticsPeriodCode): Promise<Result<AnalyticsList<MonthlyBookings>>>;
  getDepartmentsSplit(period: AnalyticsPeriodCode): Promise<Result<AnalyticsList<DepartmentShare>>>;
  /** Busiest hospitals first (bookings, then revenue); at most 10. */
  getTopHospitals(period: AnalyticsPeriodCode): Promise<Result<AnalyticsList<TopHospital>>>;
  getProviders(period: AnalyticsPeriodCode): Promise<Result<AnalyticsList<ProviderUsage>>>;
  getApiErrors(period: AnalyticsPeriodCode): Promise<Result<AnalyticsList<ApiErrorRow>>>;
}
