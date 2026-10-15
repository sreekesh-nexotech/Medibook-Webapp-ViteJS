import { ifMatch } from '@/core/api/headers';
import { platformApi } from '@/core/api/http';
import type { PageParams } from '@/core/api/pagination';

import type { DocumentRequirementDraft } from '@/features/ops-onboarding-documents/domain/entities/onboardingDocuments.entities';
import {
  toRequirementCreateBody,
  toRequirementPatchBody,
} from '@/features/ops-onboarding-documents/infrastructure/data-sources/remote/onboardingDocuments.request';
import {
  documentRequirementPageResponseSchema,
  documentRequirementResponseSchema,
} from '@/features/ops-onboarding-documents/infrastructure/data-sources/remote/onboardingDocuments.response';

const REQUIREMENTS_PATH = '/onboarding/document-requirements';

const byId = (id: string): string => `${REQUIREMENTS_PATH}/${encodeURIComponent(id)}`;

/** `GET /platform/onboarding/document-requirements` (`settings.view`), sort order first. */
export async function getRequirementsPage(page: Required<PageParams>) {
  const response = await platformApi.get(REQUIREMENTS_PATH, { params: page });
  return documentRequirementPageResponseSchema.parse(response.data);
}

/** `POST` (`settings.add`); a code already used — even by a removed item — is a 400. */
export async function postRequirement(draft: DocumentRequirementDraft) {
  const response = await platformApi.post(REQUIREMENTS_PATH, toRequirementCreateBody(draft));
  return documentRequirementResponseSchema.parse(response.data);
}

/** `PATCH …/{id}` (`settings.edit`, `If-Match` required). */
export async function patchRequirement(
  id: string,
  draft: DocumentRequirementDraft,
  version: number,
) {
  const response = await platformApi.patch(byId(id), toRequirementPatchBody(draft), {
    headers: ifMatch(version),
  });
  return documentRequirementResponseSchema.parse(response.data);
}

/** `DELETE …/{id}` (`settings.del`) — a soft delete. */
export async function deleteRequirement(id: string, version: number): Promise<void> {
  await platformApi.delete(byId(id), { headers: ifMatch(version) });
}
