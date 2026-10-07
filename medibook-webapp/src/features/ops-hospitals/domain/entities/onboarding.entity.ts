/**
 * Onboarding-pipeline entities (module P3), as `/platform/onboarding/*`
 * serves them. Plain readonly types. Documents are collected physically and
 * ops ticks a checklist (backend Q66) — there is no hospital-side upload and
 * no per-document "rejected" state.
 */

/** Where a case sits in the pipeline (backend `OnboardingCase.Stage`). */
export type OnboardingCaseStage =
  'application' | 'documents_pending' | 'review' | 'approved' | 'live' | 'rejected';

import type { FirstAdminInvitation } from '@/features/ops-hospitals/domain/entities/hospitals.entity';

/** The stages ops may set by hand; approve, reject and go-live have their own actions. */
export type ManualOnboardingStage = 'application' | 'documents_pending' | 'review';

/** One row of the pipeline list. */
export interface OnboardingCaseSummary {
  readonly id: string;
  readonly hospitalId: string;
  readonly hospitalName: string;
  /** Lifecycle status of the hospital instance (`draft`, `onboarding`, `active`, …). */
  readonly hospitalStatus: string;
  readonly stage: OnboardingCaseStage;
  /** ISO timestamp the application arrived. */
  readonly submittedAt: string | null;
  readonly approvedAt: string | null;
  readonly rejectionReason: string | null;
  /** The platform staff member working the case, if any. */
  readonly assignedToId: string | null;
  readonly notes: string | null;
  readonly createdAt: string;
  /** `If-Match` for case PATCHes (BE-29); `null` on an older backend. */
  readonly version: number | null;
}

/** Server-side pipeline query (BE-29 `q` search; stage and assignee filters). */
export interface OnboardingListQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly stages: readonly OnboardingCaseStage[];
  readonly q: string;
  readonly assignedToId: string | null;
}

/** Notes and assignee on a case (`PATCH /platform/onboarding/cases/{id}`). */
export interface OnboardingCaseChanges {
  readonly notes?: string | null;
  readonly assignedToId?: string | null;
}

/** Patient-app switches applied in the go-live transaction (CORE-03-B). */
export interface GoLiveFlags {
  readonly appVisibility: 'visible' | 'hidden';
  readonly onlineBookingEnabled: boolean;
}

/** What the hospital looks like right after go-live. */
export interface GoLiveResult {
  readonly appVisibility: 'visible' | 'hidden' | null;
  readonly onlineBookingEnabled: boolean | null;
}

/** The pipeline: up to one page of cases plus the server's count per stage. */
export interface OnboardingPipeline {
  readonly cases: readonly OnboardingCaseSummary[];
  /** Total cases on the server (may exceed `cases.length`). */
  readonly total: number;
  readonly counts: Readonly<Record<OnboardingCaseStage, number>>;
}

/** Checklist state of one physically collected document. */
export type ChecklistStatus = 'pending' | 'received' | 'verified' | 'waived';

export interface ChecklistItem {
  /** Requirement code, e.g. `gst_certificate`. */
  readonly code: string;
  readonly name: string;
  readonly status: ChecklistStatus;
  readonly receivedAt: string | null;
  readonly verifiedAt: string | null;
  /** Scan attached to the item (file purpose `kyc`), if any. */
  readonly fileId: string | null;
  /** Free-text note — also where a "send back" reason is kept. */
  readonly note: string | null;
  /** `If-Match` for this item's PATCH (BE-29); `null` on an older backend. */
  readonly version: number | null;
}

/** One reason the instance cannot go live yet. */
export interface GoLiveBlocker {
  readonly code: string;
  /** Open checklist codes or missing numbering kinds, when the blocker names any. */
  readonly details: readonly string[];
}

/** One case with its checklist and its current go-live blockers. */
export interface OnboardingCaseDetail extends OnboardingCaseSummary {
  readonly checklist: readonly ChecklistItem[];
  readonly blockers: readonly GoLiveBlocker[];
  /** `null` when never invited, or when the server does not report it. */
  readonly firstAdminInvitation: FirstAdminInvitation | null;
}

/**
 * A checklist write. Omitting `fileId` keeps any scan already attached;
 * `fileId: null` detaches it (BE-29). `note: ''` clears a send-back reason.
 */
export interface ChecklistUpdate {
  readonly status?: ChecklistStatus;
  readonly note?: string | null;
  readonly fileId?: string | null;
}

/** One entry of the platform's document catalogue. */
export interface DocumentRequirement {
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly isRequiredDefault: boolean;
  readonly sortOrder: number;
}
