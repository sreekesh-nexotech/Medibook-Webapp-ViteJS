import { fetchAllPages } from '@/core/api/pagination';
import { attempt } from '@/core/error/attempt';
import type { FieldErrors, Result } from '@/core/error/failure';
import { err } from '@/core/error/failure';

import type { OnboardingDocumentsRepository } from '@/features/ops-onboarding-documents/domain/repositories/onboardingDocuments.repository';
import * as api from '@/features/ops-onboarding-documents/infrastructure/data-sources/remote/onboardingDocuments.api';
import { REQUIREMENT_FIELD } from '@/features/ops-onboarding-documents/infrastructure/data-sources/remote/onboardingDocuments.request';
import { toDocumentRequirement } from '@/features/ops-onboarding-documents/infrastructure/data-sources/remote/onboardingDocuments.response';

/** Rename a failure's wire field keys to draft keys, so nothing upward sees DTO names. */
async function withDraftFields<T>(pending: Promise<Result<T>>): Promise<Result<T>> {
  const result = await pending;
  if (result.ok) return result;
  const fieldErrors: Record<string, FieldErrors[string]> = {};
  for (const [field, messages] of Object.entries(result.failure.fieldErrors)) {
    fieldErrors[REQUIREMENT_FIELD[field] ?? field] = messages;
  }
  return err({ ...result.failure, fieldErrors });
}

export const onboardingDocumentsRepository: OnboardingDocumentsRepository = {
  listRequirements: () =>
    attempt(async () => (await fetchAllPages(api.getRequirementsPage)).map(toDocumentRequirement)),
  createRequirement: (draft) =>
    withDraftFields(attempt(async () => toDocumentRequirement(await api.postRequirement(draft)))),
  updateRequirement: (id, draft, version) =>
    withDraftFields(
      attempt(async () => toDocumentRequirement(await api.patchRequirement(id, draft, version))),
    ),
  deleteRequirement: (id, version) =>
    attempt(async () => {
      await api.deleteRequirement(id, version);
      return null;
    }),
};
