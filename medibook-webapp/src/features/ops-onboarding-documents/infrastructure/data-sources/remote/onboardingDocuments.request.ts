import type { DocumentRequirementDraft } from '@/features/ops-onboarding-documents/domain/entities/onboardingDocuments.entities';

/** Wire field → draft field, so a `400` lands on the right input. */
export const REQUIREMENT_FIELD: Readonly<Record<string, string>> = {
  is_required_default: 'isRequiredDefault',
  sort_order: 'sortOrder',
};

/** `PATCH` body: everything but the code (changing it is refused). */
export function toRequirementPatchBody(draft: DocumentRequirementDraft) {
  const description = draft.description?.trim() ?? '';
  return {
    name: draft.name.trim(),
    description: description === '' ? null : description,
    is_required_default: draft.isRequiredDefault,
    sort_order: draft.sortOrder,
  };
}

/** `POST` body. */
export function toRequirementCreateBody(draft: DocumentRequirementDraft) {
  return { code: draft.code.trim(), ...toRequirementPatchBody(draft) };
}
