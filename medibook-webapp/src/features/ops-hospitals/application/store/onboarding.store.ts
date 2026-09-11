import { create } from 'zustand';

import { useLogsStore } from '@/features/ops-logs/application/store/logs.store';

import { useHospitalsStore } from './hospitals.store';
import { canGoLive } from './onboarding.derive';
import {
  ONBOARDING_DOC_CATALOG,
  ONBOARDING_DOC_LABEL,
  ONBOARDING_REVIEWER,
  OPS_ONBOARDING_CASES,
} from './onboarding.fixtures';
import type {
  HospitalAdminInvite,
  HospitalAdminRole,
  OnboardingCase,
  OnboardingDoc,
  OnboardingDocKey,
} from './onboarding.types';
import { opsStampNow, opsTodayIso } from './opsDates';

/**
 * Hospital-onboarding store (audit SA-01). Holds one case per tenant: the
 * document checklist with a per-document review decision, the administrator
 * invitations, and the request history.
 *
 * Two rules the actions enforce:
 *  - **Every decision is per document.** Approve and Reject take one key, stamp
 *    the reviewer and the time, and a rejection always carries its reason.
 *    There is no bulk approve, because the audit finding is precisely that the
 *    documents cannot be handled one by one.
 *  - **Nothing claims more than it did.** An invitation is *queued*, never
 *    "sent": the record carries an `Invited` status, the queue stamp and a
 *    resend counter, which is all this build can honestly show.
 */

/** Compliance-log module name for every onboarding mutation. */
const ONBOARDING_LOG_MODULE = 'Onboarding';

/** Catalog order, so a re-requested checklist always renders in one order. */
const DOC_ORDER: readonly OnboardingDocKey[] = ONBOARDING_DOC_CATALOG.map((d) => d.key);

/** New-administrator payload from the invite modal. */
export interface AdminInviteDraft {
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly role: HospitalAdminRole;
}

/** What the browser told us about an uploaded file. */
export interface UploadedFileInfo {
  readonly name: string;
  readonly size: number;
}

/** A case with nothing recorded yet — a hospital onboarded a moment ago. */
function emptyCase(hid: number): OnboardingCase {
  return { hid, docs: [], requests: [], admins: [], startedAt: opsTodayIso() };
}

function sortDocs(docs: readonly OnboardingDoc[]): readonly OnboardingDoc[] {
  return [...docs].sort((a, b) => DOC_ORDER.indexOf(a.key) - DOC_ORDER.indexOf(b.key));
}

interface OnboardingState {
  cases: readonly OnboardingCase[];
}

interface OnboardingActions {
  /** Re-read the pipeline snapshot (wired to the screen's Refresh button). */
  resync: () => Promise<void>;
  /** Record a document request: the chosen keys become the required checklist. */
  requestDocuments: (hid: number, keys: readonly OnboardingDocKey[], note?: string) => void;
  /** Attach a real file to one document; it moves to Uploaded, awaiting review. */
  uploadDoc: (hid: number, key: OnboardingDocKey, file: UploadedFileInfo) => void;
  /** Approve one document, stamping the reviewer and the time. */
  approveDoc: (hid: number, key: OnboardingDocKey) => void;
  /** Reject one document with the reason the hospital will be told. */
  rejectDoc: (hid: number, key: OnboardingDocKey, reason: string) => void;
  /** Create the hospital's administrator and queue the invitation. */
  inviteAdmin: (hid: number, draft: AdminInviteDraft) => void;
  /** Re-queue an invitation, bumping its resend count and queue stamp. */
  resendInvite: (hid: number, inviteId: number) => void;
  /** Record that the administrator has accepted (they confirmed out of band). */
  markInviteAccepted: (hid: number, inviteId: number) => void;
  /** Take the instance live. Refuses while anything is still blocking. */
  goLive: (hid: number) => boolean;
}

export const useOnboardingStore = create<OnboardingState & OnboardingActions>()((set, get) => {
  /** Apply `patch` to one hospital's case, creating the case if it is new. */
  const patchCase = (hid: number, patch: (c: OnboardingCase) => OnboardingCase): void => {
    set((s) => {
      const existing = s.cases.find((c) => c.hid === hid);
      if (!existing) return { cases: [patch(emptyCase(hid)), ...s.cases] };
      return { cases: s.cases.map((c) => (c.hid === hid ? patch(c) : c)) };
    });
  };

  /** Apply `patch` to one document of one case. */
  const patchDoc = (
    hid: number,
    key: OnboardingDocKey,
    patch: (d: OnboardingDoc) => OnboardingDoc,
  ): void => {
    patchCase(hid, (c) => ({
      ...c,
      docs: c.docs.map((d) => (d.key === key ? patch(d) : d)),
    }));
  };

  const log = (hid: number, action: string, sev: 'Info' | 'Critical' = 'Info'): void => {
    useLogsStore.getState().addLog({ hid, action, module: ONBOARDING_LOG_MODULE, sev });
  };

  /** Registry display name, so audit lines read like the rest of the console. */
  const nameOf = (hid: number): string =>
    useHospitalsStore.getState().hospitals.find((h) => h.id === hid)?.name ?? `Hospital #${hid}`;

  return {
    cases: OPS_ONBOARDING_CASES,

    resync: async () => {
      set((s) => ({ cases: [...s.cases] }));
    },

    requestDocuments: (hid, keys, note) => {
      if (keys.length === 0) return;
      patchCase(hid, (c) => {
        const existing = new Map(c.docs.map((d) => [d.key, d]));
        const requested: OnboardingDoc[] = keys.map((key) => {
          const prev = existing.get(key);
          // A document already on file keeps its upload and its decision — a
          // re-request must never quietly discard evidence.
          return prev
            ? { ...prev, required: true }
            : { key, required: true, status: 'Requested' as const };
        });
        // Anything dropped from the checklist but already uploaded stays
        // visible as an optional document rather than disappearing.
        const kept = c.docs
          .filter((d) => !keys.includes(d.key) && d.status !== 'Requested')
          .map((d) => ({ ...d, required: false }));
        const id = Math.max(0, ...c.requests.map((r) => r.id)) + 1;
        return {
          ...c,
          docs: sortDocs([...requested, ...kept]),
          requests: [
            {
              id,
              at: opsStampNow(),
              keys: [...keys],
              by: ONBOARDING_REVIEWER,
              ...(note ? { note } : {}),
            },
            ...c.requests,
          ],
        };
      });
      log(
        hid,
        `Documents requested (${keys.length}) — ${nameOf(hid)}: ${keys
          .map((k) => ONBOARDING_DOC_LABEL[k])
          .join(', ')}`,
      );
    },

    uploadDoc: (hid, key, file) => {
      patchDoc(hid, key, (d) => ({
        key: d.key,
        required: d.required,
        status: 'Uploaded',
        fileName: file.name,
        fileSize: file.size,
        uploadedAt: opsTodayIso(),
      }));
      log(hid, `Document uploaded — ${nameOf(hid)}: ${ONBOARDING_DOC_LABEL[key]} (${file.name})`);
    },

    approveDoc: (hid, key) => {
      patchDoc(hid, key, (d) => ({
        ...d,
        status: 'Approved',
        reviewedBy: ONBOARDING_REVIEWER,
        reviewedAt: opsStampNow(),
        rejectReason: undefined,
      }));
      log(hid, `Document approved — ${nameOf(hid)}: ${ONBOARDING_DOC_LABEL[key]}`);
    },

    rejectDoc: (hid, key, reason) => {
      patchDoc(hid, key, (d) => ({
        ...d,
        status: 'Rejected',
        reviewedBy: ONBOARDING_REVIEWER,
        reviewedAt: opsStampNow(),
        rejectReason: reason,
      }));
      log(
        hid,
        `Document rejected — ${nameOf(hid)}: ${ONBOARDING_DOC_LABEL[key]} (${reason})`,
        'Critical',
      );
    },

    inviteAdmin: (hid, draft) => {
      patchCase(hid, (c) => {
        const id = Math.max(0, ...c.admins.map((a) => a.id)) + 1;
        const invite: HospitalAdminInvite = {
          id,
          name: draft.name.trim(),
          email: draft.email.trim(),
          phone: draft.phone.trim(),
          role: draft.role,
          status: 'Invited',
          invitedAt: opsTodayIso(),
          lastQueuedAt: opsStampNow(),
          resends: 0,
        };
        return { ...c, admins: [...c.admins, invite] };
      });
      log(hid, `Administrator invitation queued — ${nameOf(hid)}: ${draft.email} (${draft.role})`);
    },

    resendInvite: (hid, inviteId) => {
      const target = get()
        .cases.find((c) => c.hid === hid)
        ?.admins.find((a) => a.id === inviteId);
      patchCase(hid, (c) => ({
        ...c,
        admins: c.admins.map((a) =>
          a.id === inviteId
            ? { ...a, status: 'Invited', resends: a.resends + 1, lastQueuedAt: opsStampNow() }
            : a,
        ),
      }));
      log(
        hid,
        `Administrator invitation re-queued — ${nameOf(hid)}: ${target ? target.email : `#${inviteId}`}`,
      );
    },

    markInviteAccepted: (hid, inviteId) => {
      const target = get()
        .cases.find((c) => c.hid === hid)
        ?.admins.find((a) => a.id === inviteId);
      patchCase(hid, (c) => ({
        ...c,
        admins: c.admins.map((a) =>
          a.id === inviteId ? { ...a, status: 'Accepted', acceptedAt: opsStampNow() } : a,
        ),
      }));
      log(
        hid,
        `Administrator invitation accepted — ${nameOf(hid)}: ${target ? target.email : `#${inviteId}`}`,
      );
    },

    goLive: (hid) => {
      const current = get().cases.find((c) => c.hid === hid);
      if (!current || !canGoLive(current)) return false;
      patchCase(hid, (c) => ({ ...c, liveAt: opsTodayIso() }));
      // The registry is the tenant's identity: going live is what flips it to
      // Active with its KYC verified, exactly as the approve flow always did.
      useHospitalsStore.getState().approve(hid);
      log(hid, `Hospital went live — ${nameOf(hid)}`);
      return true;
    },
  };
});

/** The case for one tenant, or a blank one for a hospital with no records yet. */
export function onboardingCaseFor(hid: number): OnboardingCase {
  return useOnboardingStore.getState().cases.find((c) => c.hid === hid) ?? emptyCase(hid);
}
