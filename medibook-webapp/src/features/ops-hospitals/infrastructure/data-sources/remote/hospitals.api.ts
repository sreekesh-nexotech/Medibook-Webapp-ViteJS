import { platformApi } from '@/core/api/http';

import type {
  HospitalLifecycle,
  HospitalListQuery,
  HospitalSuspendReason,
} from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import type {
  HospitalDetailResponse,
  HospitalResponse,
} from '@/features/ops-hospitals/infrastructure/data-sources/remote/hospitals.response';
import {
  hospitalDetailResponseSchema,
  hospitalPageResponseSchema,
  hospitalResponseSchema,
} from '@/features/ops-hospitals/infrastructure/data-sources/remote/hospitals.response';

/** A page of one row is enough to read a filtered `total`. */
const COUNT_PAGE_SIZE = 1;

/** `status` accepts several values, comma-separated (`FilterSpec` `many=True`). */
function statusParam(statuses: readonly HospitalLifecycle[]): string | undefined {
  return statuses.length > 0 ? statuses.join(',') : undefined;
}

/** `GET /platform/hospitals` — one page of the registry. */
export async function getHospitals(query: HospitalListQuery) {
  const response = await platformApi.get('/hospitals', {
    params: {
      page: query.page,
      page_size: query.pageSize,
      q: query.q || undefined,
      status: statusParam(query.statuses),
      plan_id: query.planId ?? undefined,
      sort: query.sort ?? undefined,
    },
  });
  return hospitalPageResponseSchema.parse(response.data);
}

/** How many hospitals have one of `statuses` (all of them when empty). */
export async function countHospitals(statuses: readonly HospitalLifecycle[]): Promise<number> {
  const response = await platformApi.get('/hospitals', {
    params: { page_size: COUNT_PAGE_SIZE, status: statusParam(statuses) },
  });
  return hospitalPageResponseSchema.parse(response.data).total;
}

/** `GET /platform/hospitals/{id}` — profile plus subscription, usage, onboarding and staff. */
export async function getHospital(id: string): Promise<HospitalDetailResponse> {
  const response = await platformApi.get(`/hospitals/${encodeURIComponent(id)}`);
  return hospitalDetailResponseSchema.parse(response.data);
}

/** `POST /platform/hospitals/{id}/suspend {reason, note}`. */
export async function postSuspendHospital(
  id: string,
  reason: HospitalSuspendReason,
  note: string | null,
): Promise<HospitalResponse> {
  const response = await platformApi.post(`/hospitals/${encodeURIComponent(id)}/suspend`, {
    reason,
    note,
  });
  return hospitalResponseSchema.parse(response.data);
}

/** `POST /platform/hospitals/{id}/reinstate`. */
export async function postReinstateHospital(id: string): Promise<HospitalResponse> {
  const response = await platformApi.post(`/hospitals/${encodeURIComponent(id)}/reinstate`);
  return hospitalResponseSchema.parse(response.data);
}
