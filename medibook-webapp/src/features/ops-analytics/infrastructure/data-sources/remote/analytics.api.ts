import { platformApi } from '@/core/api/http';

import type { AnalyticsPeriodCode } from '@/features/ops-analytics/domain/entities/analytics.entities';
import type {
  ApiErrorsResponse,
  BookingsByMonthResponse,
  DepartmentsSplitResponse,
  OverviewResponse,
  ProvidersResponse,
  TopHospitalsResponse,
} from '@/features/ops-analytics/infrastructure/data-sources/remote/analytics.response';
import {
  apiErrorsResponseSchema,
  bookingsByMonthResponseSchema,
  departmentsSplitResponseSchema,
  overviewResponseSchema,
  providersResponseSchema,
  topHospitalsResponseSchema,
} from '@/features/ops-analytics/infrastructure/data-sources/remote/analytics.response';

/** `GET /platform/analytics/<tab>?period=` — platform-wide (no `hospital_id`). */
async function getTab(tab: string, period: AnalyticsPeriodCode): Promise<unknown> {
  const response = await platformApi.get(`/analytics/${tab}`, { params: { period } });
  return response.data;
}

export async function getOverview(period: AnalyticsPeriodCode): Promise<OverviewResponse> {
  return overviewResponseSchema.parse(await getTab('overview', period));
}

export async function getBookingsByMonth(
  period: AnalyticsPeriodCode,
): Promise<BookingsByMonthResponse> {
  return bookingsByMonthResponseSchema.parse(await getTab('bookings-by-month', period));
}

export async function getDepartmentsSplit(
  period: AnalyticsPeriodCode,
): Promise<DepartmentsSplitResponse> {
  return departmentsSplitResponseSchema.parse(await getTab('departments-split', period));
}

export async function getTopHospitals(period: AnalyticsPeriodCode): Promise<TopHospitalsResponse> {
  return topHospitalsResponseSchema.parse(await getTab('top-hospitals', period));
}

export async function getProviders(period: AnalyticsPeriodCode): Promise<ProvidersResponse> {
  return providersResponseSchema.parse(await getTab('providers', period));
}

export async function getApiErrors(period: AnalyticsPeriodCode): Promise<ApiErrorsResponse> {
  return apiErrorsResponseSchema.parse(await getTab('errors', period));
}
