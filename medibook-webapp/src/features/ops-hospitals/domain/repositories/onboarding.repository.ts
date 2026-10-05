import type { Result } from '@/core/error/failure';

import type {
  ChecklistItem,
  ChecklistUpdate,
  DocumentRequirement,
  ManualOnboardingStage,
  OnboardingCaseDetail,
  OnboardingPipeline,
} from '@/features/ops-hospitals/domain/entities/onboarding.entity';

/** The hospital-onboarding pipeline (P3). */
export interface OnboardingRepository {
  /** The pipeline — the newest cases first, plus counts per stage. */
  listCases(): Promise<Result<OnboardingPipeline>>;
  getCase(caseId: string): Promise<Result<OnboardingCaseDetail>>;
  setStage(caseId: string, stage: ManualOnboardingStage): Promise<Result<OnboardingCaseDetail>>;
  /** Close the application as rejected, with the reason the hospital is given. */
  rejectCase(caseId: string, reason: string): Promise<Result<OnboardingCaseDetail>>;
  /** Tick one document; an item not on the checklist yet is added. */
  updateChecklistItem(
    caseId: string,
    code: string,
    update: ChecklistUpdate,
  ): Promise<Result<ChecklistItem>>;
  listDocumentRequirements(): Promise<Result<readonly DocumentRequirement[]>>;
  /** Upload a scan of a collected document; resolves to the stored file id. */
  uploadScan(file: File): Promise<Result<string>>;
  /** Mark the hospital's case approved. */
  approveHospital(hospitalId: string): Promise<Result<null>>;
  /** Take the hospital live; fails with `GO_LIVE_BLOCKED` while anything blocks it. */
  goLive(hospitalId: string): Promise<Result<null>>;
}
