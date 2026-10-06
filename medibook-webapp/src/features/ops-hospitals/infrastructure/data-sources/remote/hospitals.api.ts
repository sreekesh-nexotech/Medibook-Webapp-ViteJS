import { ifMatch } from '@/core/api/headers';
import { platformApi } from '@/core/api/http';

import type {
  HospitalAppVisibility,
  HospitalCommissionChange,
  HospitalConvenienceFeeChange,
  HospitalCreateInput,
  HospitalLifecycle,
  HospitalListQuery,
  HospitalSuspendReason,
} from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import type { HospitalPatchRequest } from '@/features/ops-hospitals/infrastructure/data-sources/remote/hospitals.request';
import { toHospitalCreateRequest } from '@/features/ops-hospitals/infrastructure/data-sources/remote/hospitals.request';
import type {
  HospitalDetailResponse,
  HospitalResponse,
} from '@/features/ops-hospitals/infrastructure/data-sources/remote/hospitals.response';
import {
  hospitalCreatedResponseSchema,
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

/**
 * `POST /platform/hospitals` — provisions the hospital, its settings, roles,
 * numbering series, subscription and onboarding case, and invites the first
 * administrator.
 */
export async function postHospital(input: HospitalCreateInput): Promise<HospitalResponse> {
  const response = await platformApi.post('/hospitals', toHospitalCreateRequest(input));
  return hospitalCreatedResponseSchema.parse(response.data).hospital;
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

/** `PATCH /platform/hospitals/{id}` (`If-Match`) — answers with the full detail. */
export async function patchHospital(
  id: string,
  body: HospitalPatchRequest,
  version: number,
): Promise<HospitalDetailResponse> {
  const response = await platformApi.patch(`/hospitals/${encodeURIComponent(id)}`, body, {
    headers: ifMatch(version),
  });
  return hospitalDetailResponseSchema.parse(response.data);
}

/** `POST /platform/hospitals/{id}/set-visibility {visibility}` (Q67). */
export async function postSetVisibility(
  id: string,
  visibility: HospitalAppVisibility,
): Promise<HospitalResponse> {
  const response = await platformApi.post(`/hospitals/${encodeURIComponent(id)}/set-visibility`, {
    visibility,
  });
  return hospitalResponseSchema.parse(response.data);
}

/** `POST /platform/hospitals/{id}/set-commission` — appends to the commission history (Q9). */
export async function postSetCommission(
  id: string,
  change: HospitalCommissionChange,
): Promise<HospitalResponse> {
  const response = await platformApi.post(`/hospitals/${encodeURIComponent(id)}/set-commission`, {
    commission_bp: change.commissionBp,
    effective_from: change.effectiveFrom,
    note: change.note,
  });
  return hospitalResponseSchema.parse(response.data);
}

/** `POST /platform/hospitals/{id}/set-convenience-fee {kind, value}` — new bookings only (Q4). */
export async function postSetConvenienceFee(
  id: string,
  change: HospitalConvenienceFeeChange,
): Promise<HospitalResponse> {
  const response = await platformApi.post(
    `/hospitals/${encodeURIComponent(id)}/set-convenience-fee`,
    { kind: change.kind, value: change.value },
  );
  return hospitalResponseSchema.parse(response.data);
}
