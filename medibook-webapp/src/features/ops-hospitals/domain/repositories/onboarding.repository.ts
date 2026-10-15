import type { Result } from '@/core/error/failure';

import type {
  ChecklistItem,
  ChecklistUpdate,
  DocumentRequirement,
  GoLiveFlags,
  GoLiveResult,
  ManualOnboardingStage,
  OnboardingCaseChanges,
  OnboardingCaseDetail,
  OnboardingListQuery,
  OnboardingPipeline,
} from '@/features/ops-hospitals/domain/entities/onboarding.entity';

/**
 * The hospital-onboarding pipeline (P3). Case and checklist writes carry the
 * row `version` as `If-Match` (BE-29); `null` when the server sent none.
 */
export interface OnboardingRepository {
  /** One page of the pipeline (server-side stage, search and assignee filters) plus counts. */
  listCases(query: OnboardingListQuery): Promise<Result<OnboardingPipeline>>;
  getCase(caseId: string): Promise<Result<OnboardingCaseDetail>>;
  /** Move a case between the manual stages — also how a rejected case is re-opened. */
  setStage(
    caseId: string,
    stage: ManualOnboardingStage,
    version: number | null,
  ): Promise<Result<OnboardingCaseDetail>>;
  /** Close the application as rejected (the hospital is suspended, decision 9). */
  rejectCase(
    caseId: string,
    reason: string,
    version: number | null,
  ): Promise<Result<OnboardingCaseDetail>>;
  /** Notes and assignee. */
  updateCase(
    caseId: string,
    changes: OnboardingCaseChanges,
    version: number | null,
  ): Promise<Result<OnboardingCaseDetail>>;
  /** Tick one document; an item not on the checklist yet is added. */
  updateChecklistItem(
    caseId: string,
    code: string,
    update: ChecklistUpdate,
    version: number | null,
  ): Promise<Result<ChecklistItem>>;
  listDocumentRequirements(): Promise<Result<readonly DocumentRequirement[]>>;
  /** Upload a scan of a collected document; resolves to the stored file id. */
  uploadScan(file: File): Promise<Result<string>>;
  /** Mark the hospital's case approved. */
  approveHospital(hospitalId: string): Promise<Result<null>>;
  /**
   * Take the hospital live, applying its patient-app switches in the same
   * call (`null` leaves them as they are); `GO_LIVE_BLOCKED` while blocked.
   */
  goLive(hospitalId: string, flags: GoLiveFlags | null): Promise<Result<GoLiveResult>>;
}
