/**
 * Pure onboarding rules (audit SA-01). Stage and go-live gating are **derived**
 * from the documents and the administrator invitation, so a case can never
 * claim a stage its own records contradict.
 */
import { ONBOARDING_DOC_LABEL } from '@/features/ops-hospitals/application/store/onboarding.fixtures';
import type {
  HospitalAdminInvite,
  OnboardingCase,
  OnboardingDoc,
  OnboardingStage,
} from '@/features/ops-hospitals/application/store/onboarding.types';

/** Required documents only — optional extras never block go-live. */
export function requiredDocs(c: OnboardingCase): readonly OnboardingDoc[] {
  return c.docs.filter((d) => d.required);
}

/** The invitation that counts: an accepted one, else the most recent. */
export function primaryAdmin(c: OnboardingCase): HospitalAdminInvite | null {
  return c.admins.find((a) => a.status === 'Accepted') ?? c.admins[0] ?? null;
}

/** True once at least one invited administrator has accepted. */
export function hasAcceptedAdmin(c: OnboardingCase): boolean {
  return c.admins.some((a) => a.status === 'Accepted');
}

/**
 * Which pipeline column the case belongs in:
 *   Live                 it is serving patients
 *   Approved             every required document is approved — waiting on go-live
 *   Under review         something has arrived (or bounced) and needs a decision
 *   Documents requested  a checklist is out, nothing has arrived yet
 *   Application          no checklist has been sent
 */
export function stageOf(c: OnboardingCase): OnboardingStage {
  if (c.liveAt) return 'Live';
  const req = requiredDocs(c);
  if (req.length === 0) return 'Application';
  if (req.every((d) => d.status === 'Approved')) return 'Approved';
  if (req.some((d) => d.status === 'Uploaded' || d.status === 'Rejected')) return 'Under review';
  return 'Documents requested';
}

/**
 * Everything still standing between this case and go-live, phrased for the
 * screen. An empty list is the only thing that enables the Go Live button —
 * the audit's requirement that a hospital cannot reach `live` until every
 * required document is approved and an admin has accepted the invitation.
 */
export function goLiveBlockers(c: OnboardingCase): readonly string[] {
  if (c.liveAt) return [];
  const out: string[] = [];
  const req = requiredDocs(c);

  if (req.length === 0) {
    out.push('No document checklist has been requested yet.');
  } else {
    const awaiting = req.filter((d) => d.status === 'Requested');
    const rejected = req.filter((d) => d.status === 'Rejected');
    const unreviewed = req.filter((d) => d.status === 'Uploaded');
    if (awaiting.length > 0) {
      out.push(
        `${awaiting.length} required document${awaiting.length === 1 ? '' : 's'} not uploaded yet: ${awaiting
          .map((d) => ONBOARDING_DOC_LABEL[d.key])
          .join(', ')}.`,
      );
    }
    if (rejected.length > 0) {
      out.push(
        `${rejected.length} document${rejected.length === 1 ? ' was' : 's were'} rejected and must be re-uploaded: ${rejected
          .map((d) => ONBOARDING_DOC_LABEL[d.key])
          .join(', ')}.`,
      );
    }
    if (unreviewed.length > 0) {
      out.push(
        `${unreviewed.length} uploaded document${unreviewed.length === 1 ? '' : 's'} still awaiting approval.`,
      );
    }
  }

  if (c.admins.length === 0) {
    out.push('No administrator has been created for this hospital.');
  } else if (!hasAcceptedAdmin(c)) {
    out.push('The administrator has not accepted the invitation yet.');
  }
  return out;
}

/** True when nothing is blocking and the instance is not already live. */
export function canGoLive(c: OnboardingCase): boolean {
  return !c.liveAt && goLiveBlockers(c).length === 0;
}

/** How many of the required documents are approved, for the progress line. */
export function docProgress(c: OnboardingCase): {
  readonly approved: number;
  readonly total: number;
} {
  const req = requiredDocs(c);
  return { approved: req.filter((d) => d.status === 'Approved').length, total: req.length };
}
