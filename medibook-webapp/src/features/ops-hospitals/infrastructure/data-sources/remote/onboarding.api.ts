import { platformApi } from '@/core/api/http';
import { MAX_PAGE_SIZE, fetchAllPages } from '@/core/api/pagination';

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
  readonly status: string;
  readonly note?: string | null;
  readonly file_id?: string;
}

export async function listCases(): Promise<CaseListResponse> {
  const response = await platformApi.get(CASES_PATH, {
    params: { page: 1, page_size: MAX_PAGE_SIZE },
  });
  return caseListResponseSchema.parse(response.data);
}

export async function getCase(caseId: string): Promise<CaseDetailResponse> {
  const response = await platformApi.get(`${CASES_PATH}/${caseId}`);
  return caseDetailResponseSchema.parse(response.data);
}

export async function patchCase(
  caseId: string,
  body: Readonly<Record<string, string>>,
): Promise<CaseDetailResponse> {
  const response = await platformApi.patch(`${CASES_PATH}/${caseId}`, body);
  return caseDetailResponseSchema.parse(response.data);
}

export async function patchChecklistItem(
  caseId: string,
  code: string,
  body: ChecklistWriteRequest,
): Promise<ChecklistItemResponse> {
  const response = await platformApi.patch(
    `${CASES_PATH}/${caseId}/checklist/${encodeURIComponent(code)}`,
    body,
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
  const response = await platformApi.post(`${HOSPITALS_PATH}/${hospitalId}/approve`);
  hospitalActionResponseSchema.parse(response.data);
}

export async function postGoLive(hospitalId: string): Promise<void> {
  const response = await platformApi.post(`${HOSPITALS_PATH}/${hospitalId}/go-live`);
  hospitalActionResponseSchema.parse(response.data);
}
