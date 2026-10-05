import { z } from 'zod';

import type {
  AnalyticsList,
  AnalyticsOverview,
  AnalyticsWindow,
  ApiErrorRow,
  DepartmentShare,
  MonthlyBookings,
  ProviderUsage,
  TopHospital,
} from '@/features/ops-analytics/domain/entities/analytics.entities';

/**
 * Analytics envelopes (backend `analytics/services/analytics_queries.py`);
 * `schema.yml` types them only as `object`. Every response carries the
 * window it covers: `{period, date_from, date_to, hospital_id, …}`.
 */

const PAISE_PER_RUPEE = 100;
/** Basis points per percent. */
const BP_PER_PERCENT = 100;

const windowShape = {
  period: z.enum(['7d', '30d', '90d', '12m']),
  date_from: z.string(),
  date_to: z.string(),
  hospital_id: z.string().nullable(),
};

const count = z.number().int();

export const overviewResponseSchema = z.object({
  ...windowShape,
  metrics: z.object({
    bookings_online: count,
    bookings_walk_in: count,
    bookings_total: count,
    cancellations: count,
    no_shows: count,
    completed: count,
    revenue_paise: count,
    refunds_paise: count,
    new_patients: count,
  }),
});

export const bookingsByMonthResponseSchema = z.object({
  ...windowShape,
  results: z.array(z.object({ month: z.string(), online: count, walk_in: count, total: count })),
});

export const departmentsSplitResponseSchema = z.object({
  ...windowShape,
  total: count,
  results: z.array(z.object({ department_code: z.string(), bookings: count, share_bp: count })),
});

export const topHospitalsResponseSchema = z.object({
  ...windowShape,
  results: z.array(
    z.object({
      hospital_id: z.string(),
      name: z.string().nullable(),
      bookings: count,
      revenue_paise: count,
    }),
  ),
});

/** A provider row has only the metrics metered for it in the window. */
export const providersResponseSchema = z.object({
  ...windowShape,
  results: z.array(
    z.object({
      provider: z.string(),
      requests: count.optional(),
      messages: count.optional(),
      errors: count.optional(),
      cost_paise: count.optional(),
    }),
  ),
});

export const apiErrorsResponseSchema = z.object({
  ...windowShape,
  results: z.array(
    z.object({
      surface: z.string(),
      endpoint_group: z.string(),
      requests: count,
      errors_4xx: count,
      errors_5xx: count,
      p95_ms_max: count,
      error_rate_bp: count,
    }),
  ),
});

type WindowDto = Pick<z.infer<typeof overviewResponseSchema>, 'period' | 'date_from' | 'date_to'>;

function toWindow(dto: WindowDto): AnalyticsWindow {
  return { period: dto.period, dateFrom: dto.date_from, dateTo: dto.date_to };
}

function rupees(paise: number): number {
  return paise / PAISE_PER_RUPEE;
}

export function toOverview(dto: z.infer<typeof overviewResponseSchema>): AnalyticsOverview {
  const m = dto.metrics;
  return {
    window: toWindow(dto),
    bookingsTotal: m.bookings_total,
    bookingsOnline: m.bookings_online,
    bookingsWalkIn: m.bookings_walk_in,
    completed: m.completed,
    cancellations: m.cancellations,
    noShows: m.no_shows,
    revenueRupees: rupees(m.revenue_paise),
    refundsRupees: rupees(m.refunds_paise),
    newPatients: m.new_patients,
  };
}

export function toBookingsByMonth(
  dto: z.infer<typeof bookingsByMonthResponseSchema>,
): AnalyticsList<MonthlyBookings> {
  return {
    window: toWindow(dto),
    items: dto.results.map((r) => ({
      month: r.month,
      online: r.online,
      walkIn: r.walk_in,
      total: r.total,
    })),
  };
}

export function toDepartmentsSplit(
  dto: z.infer<typeof departmentsSplitResponseSchema>,
): AnalyticsList<DepartmentShare> {
  return {
    window: toWindow(dto),
    items: dto.results.map((r) => ({
      departmentCode: r.department_code,
      bookings: r.bookings,
      sharePct: r.share_bp / BP_PER_PERCENT,
    })),
  };
}

export function toTopHospitals(
  dto: z.infer<typeof topHospitalsResponseSchema>,
): AnalyticsList<TopHospital> {
  return {
    window: toWindow(dto),
    items: dto.results.map((r) => ({
      hospitalId: r.hospital_id,
      name: r.name,
      bookings: r.bookings,
      revenueRupees: rupees(r.revenue_paise),
    })),
  };
}

export function toProviders(
  dto: z.infer<typeof providersResponseSchema>,
): AnalyticsList<ProviderUsage> {
  return {
    window: toWindow(dto),
    items: dto.results.map((r) => ({
      provider: r.provider,
      requests: r.requests ?? 0,
      messages: r.messages ?? 0,
      errors: r.errors ?? 0,
      costRupees: rupees(r.cost_paise ?? 0),
    })),
  };
}

export function toApiErrors(
  dto: z.infer<typeof apiErrorsResponseSchema>,
): AnalyticsList<ApiErrorRow> {
  return {
    window: toWindow(dto),
    items: dto.results.map((r) => ({
      surface: r.surface,
      endpointGroup: r.endpoint_group,
      requests: r.requests,
      errors4xx: r.errors_4xx,
      errors5xx: r.errors_5xx,
      p95Ms: r.p95_ms_max,
      errorPct: r.error_rate_bp / BP_PER_PERCENT,
    })),
  };
}

export type OverviewResponse = z.infer<typeof overviewResponseSchema>;
export type BookingsByMonthResponse = z.infer<typeof bookingsByMonthResponseSchema>;
export type DepartmentsSplitResponse = z.infer<typeof departmentsSplitResponseSchema>;
export type TopHospitalsResponse = z.infer<typeof topHospitalsResponseSchema>;
export type ProvidersResponse = z.infer<typeof providersResponseSchema>;
export type ApiErrorsResponse = z.infer<typeof apiErrorsResponseSchema>;
