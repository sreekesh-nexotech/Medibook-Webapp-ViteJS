/**
 * Hospital-onboarding view-model types (audit SA-01: "No screen creates the
 * hospital's first administrator, sends an invitation, or requests documents.
 * KYC documents cannot be uploaded or approved one by one.").
 *
 * The registry record (`OpsHospital`) stays the tenant's identity; everything
 * an application goes through before it can serve patients lives here.
 */

/** Where an application sits in the onboarding pipeline. Always derived. */
export type OnboardingStage =
  'Application' | 'Documents requested' | 'Under review' | 'Approved' | 'Live';

/** The pipeline in order, for the stage strip and the stage filter. */
export const ONBOARDING_STAGES: readonly OnboardingStage[] = [
  'Application',
  'Documents requested',
  'Under review',
  'Approved',
  'Live',
];

/** Every document type the platform can ask an applicant for. */
export type OnboardingDocKey =
  'reg' | 'gst' | 'licence' | 'bankproof' | 'pan' | 'fire' | 'biomed' | 'pharmacy';

/**
 * Review state of one document. `Requested` means asked for but nothing has
 * arrived; `Uploaded` means a file is on file and waiting for a reviewer.
 * Approve and Reject are decisions taken per document, never in bulk.
 */
export type DocReviewStatus = 'Requested' | 'Uploaded' | 'Approved' | 'Rejected';

/** One requested document and everything known about its review. */
export interface OnboardingDoc {
  readonly key: OnboardingDocKey;
  /** Required documents gate go-live; optional ones are nice to have. */
  readonly required: boolean;
  readonly status: DocReviewStatus;
  /** Name of the file on record, once something has been uploaded. */
  readonly fileName?: string;
  /** Size of that file in bytes, as the browser reported it. */
  readonly fileSize?: number;
  /** Local-calendar ISO date the file arrived. */
  readonly uploadedAt?: string;
  readonly reviewedBy?: string;
  /** Stamp of the review decision, e.g. "June 13, 2026 · 14:32". */
  readonly reviewedAt?: string;
  /** Why it was rejected — the applicant is told this verbatim. */
  readonly rejectReason?: string;
}

/** What the hospital's first administrator will be able to do. */
export type HospitalAdminRole = 'Hospital Admin' | 'Billing Admin' | 'Front Desk Lead';

/**
 * State of an administrator invitation. `Invited` is deliberately honest: the
 * invitation is queued in the console, not delivered by this build.
 */
export type AdminInviteStatus = 'Invited' | 'Accepted' | 'Expired';

/** The hospital's first administrator, as invited from the ops console. */
export interface HospitalAdminInvite {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly role: HospitalAdminRole;
  readonly status: AdminInviteStatus;
  /** Local-calendar ISO date the invitation was first queued. */
  readonly invitedAt: string;
  /** Stamp of the most recent queue attempt (first send or a resend). */
  readonly lastQueuedAt: string;
  /** How many times ops has re-queued it. */
  readonly resends: number;
  /** Stamp of acceptance, recorded by ops when the admin confirms. */
  readonly acceptedAt?: string;
}

/** One recorded "please send us these documents" request. */
export interface DocumentRequest {
  readonly id: number;
  /** Stamp of the request, e.g. "June 13, 2026 · 14:32". */
  readonly at: string;
  readonly keys: readonly OnboardingDocKey[];
  readonly note?: string;
  readonly by: string;
}

/** One hospital's onboarding case. Stage and blockers are derived, not stored. */
export interface OnboardingCase {
  /** Tenant id in the ops hospital registry (joined on id, never on name). */
  readonly hid: number;
  /** The documents asked for. Empty until ops requests a checklist. */
  readonly docs: readonly OnboardingDoc[];
  /** Newest request first. */
  readonly requests: readonly DocumentRequest[];
  readonly admins: readonly HospitalAdminInvite[];
  /** Local-calendar ISO date the application arrived. */
  readonly startedAt: string;
  /** Local-calendar ISO date the instance went live, if it has. */
  readonly liveAt?: string;
}
