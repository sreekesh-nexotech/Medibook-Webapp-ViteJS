import { ifMatch } from '@/core/api/headers';
import { platformApi } from '@/core/api/http';
import { fetchAllPages } from '@/core/api/pagination';

import type {
  GoLiveFlags,
  OnboardingListQuery,
} from '@/features/ops-hospitals/domain/entities/onboarding.entity';
import type {
  CaseDetailResponse,
  CaseListResponse,
  ChecklistItemResponse,
  RequirementResponse,
} from '@/features/ops-hospitals/infrastructure/data-sources/remote/onboarding.response';
import {
  caseDetailResponseSchema,
  caseListResponseSchema,
  checklistItemResponseSchema,
  hospitalActionResponseSchema,
  requirementPageResponseSchema,
} from '@/features/ops-hospitals/infrastructure/data-sources/remote/onboarding.response';

/** Onboarding endpoints (`/api/v1/platform/…`). Every body is Zod-validated. */

const CASES_PATH = '/onboarding/cases';
const REQUIREMENTS_PATH = '/onboarding/document-requirements';
const HOSPITALS_PATH = '/hospitals';

/** Request body for a checklist write (`PatchedOnboardingChecklistUpdateRequest`). */
export interface ChecklistWriteRequest {
  readonly status?: string;
  readonly note?: string | null;
  /** `null` detaches the scan (BE-29); omitted keeps it. */
  readonly file_id?: string | null;
}

/** `If-Match` when the row's version is known (BE-29 requires it; an older backend ignores it). */
function versionHeaders(version: number | null) {
  return version === null ? undefined : ifMatch(version);
}

/** `GET /platform/onboarding/cases?stage&q&assigned_to_id&page` — the server filters and pages. */
export async function listCases(query: OnboardingListQuery): Promise<CaseListResponse> {
  const response = await platformApi.get(CASES_PATH, {
    params: {
      page: query.page,
      page_size: query.pageSize,
      stage: query.stages.length > 0 ? query.stages.join(',') : undefined,
      q: query.q || undefined,
      assigned_to_id: query.assignedToId ?? undefined,
    },
  });
  return caseListResponseSchema.parse(response.data);
}

export async function getCase(caseId: string): Promise<CaseDetailResponse> {
  const response = await platformApi.get(`${CASES_PATH}/${encodeURIComponent(caseId)}`);
  return caseDetailResponseSchema.parse(response.data);
}

/** `PATCH /platform/onboarding/cases/{id}` (`If-Match`: the case version, BE-29). */
export async function patchCase(
  caseId: string,
  body: Readonly<Record<string, string | null>>,
  version: number | null,
): Promise<CaseDetailResponse> {
  const response = await platformApi.patch(`${CASES_PATH}/${encodeURIComponent(caseId)}`, body, {
    headers: versionHeaders(version),
  });
  return caseDetailResponseSchema.parse(response.data);
}

/** `PATCH …/checklist/{code}` (`If-Match`: the item version once it exists, BE-29). */
export async function patchChecklistItem(
  caseId: string,
  code: string,
  body: ChecklistWriteRequest,
  version: number | null,
): Promise<ChecklistItemResponse> {
  const response = await platformApi.patch(
    `${CASES_PATH}/${encodeURIComponent(caseId)}/checklist/${encodeURIComponent(code)}`,
    body,
    { headers: versionHeaders(version) },
  );
  return checklistItemResponseSchema.parse(response.data);
}

export async function listRequirements(): Promise<RequirementResponse[]> {
  return fetchAllPages(async (params) => {
    const response = await platformApi.get(REQUIREMENTS_PATH, { params });
    return requirementPageResponseSchema.parse(response.data);
  });
}

export async function postApprove(hospitalId: string): Promise<void> {
  const response = await platformApi.post(
    `${HOSPITALS_PATH}/${encodeURIComponent(hospitalId)}/approve`,
  );
  hospitalActionResponseSchema.parse(response.data);
}

/**
 * `POST /platform/hospitals/{id}/go-live {app_visibility, online_booking_enabled}`
 * — the flags are applied in the same transaction (CORE-03-B). An older
 * backend ignores them; the answer says what the hospital looks like now.
 */
export async function postGoLive(hospitalId: string, flags: GoLiveFlags | null) {
  const response = await platformApi.post(
    `${HOSPITALS_PATH}/${encodeURIComponent(hospitalId)}/go-live`,
    flags
      ? { app_visibility: flags.appVisibility, online_booking_enabled: flags.onlineBookingEnabled }
      : {},
  );
  return hospitalActionResponseSchema.parse(response.data);
}
