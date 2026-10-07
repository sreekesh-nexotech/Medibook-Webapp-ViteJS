import type { Result } from '@/core/error/failure';

import type {
  DocumentRequirement,
  DocumentRequirementDraft,
} from '@/features/ops-onboarding-documents/domain/entities/onboardingDocuments.entities';

/** The onboarding document catalogue (`settings.*`). */
export interface OnboardingDocumentsRepository {
  listRequirements(): Promise<Result<DocumentRequirement[]>>;
  createRequirement(draft: DocumentRequirementDraft): Promise<Result<DocumentRequirement>>;
  /** Everything but the code. */
  updateRequirement(
    id: string,
    draft: DocumentRequirementDraft,
    version: number,
  ): Promise<Result<DocumentRequirement>>;
  /** Soft delete (D-07). */
  deleteRequirement(id: string, version: number): Promise<Result<null>>;
}
