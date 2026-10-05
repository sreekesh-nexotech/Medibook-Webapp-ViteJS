import { attempt } from '@/core/error/attempt';

import type { AnalyticsRepository } from '@/features/ops-analytics/domain/repositories/analytics.repository';
import * as api from '@/features/ops-analytics/infrastructure/data-sources/remote/analytics.api';
import {
  toApiErrors,
  toBookingsByMonth,
  toDepartmentsSplit,
  toOverview,
  toProviders,
  toTopHospitals,
} from '@/features/ops-analytics/infrastructure/data-sources/remote/analytics.response';

export const analyticsRepository: AnalyticsRepository = {
  getOverview: (period) => attempt(async () => toOverview(await api.getOverview(period))),
  getBookingsByMonth: (period) =>
    attempt(async () => toBookingsByMonth(await api.getBookingsByMonth(period))),
  getDepartmentsSplit: (period) =>
    attempt(async () => toDepartmentsSplit(await api.getDepartmentsSplit(period))),
  getTopHospitals: (period) =>
    attempt(async () => toTopHospitals(await api.getTopHospitals(period))),
  getProviders: (period) => attempt(async () => toProviders(await api.getProviders(period))),
  getApiErrors: (period) => attempt(async () => toApiErrors(await api.getApiErrors(period))),
};
