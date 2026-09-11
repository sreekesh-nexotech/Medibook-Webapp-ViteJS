import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useOpsAct } from '@/shared/hooks/useOpsAct';
import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/ui/Icon';
import { IconBtn } from '@/shared/ui/IconBtn';
import { OpsConfirm } from '@/shared/ui/OpsConfirm';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import { toast } from '@/shared/ui/toast/toast.store';

import { opsHospitalDetailPath } from '@/app/router/paths';

import type { OpsHospital } from '@/features/ops-hospitals/application/store/hospitals.types';
import {
  ONBOARDING_DOC_CATALOG,
  ONBOARDING_DOC_LABEL,
} from '@/features/ops-hospitals/application/store/onboarding.fixtures';
import {
  docProgress,
  goLiveBlockers,
  stageOf,
} from '@/features/ops-hospitals/application/store/onboarding.derive';
import { useOnboardingStore } from '@/features/ops-hospitals/application/store/onboarding.store';
import type {
  OnboardingCase,
  OnboardingDoc,
  OnboardingDocKey,
} from '@/features/ops-hospitals/application/store/onboarding.types';
import { longDateFromIso } from '@/features/ops-hospitals/application/store/opsDates';
import { AdminInviteModal } from '@/features/ops-hospitals/presentation/components/AdminInviteModal';
import { RejectDocumentModal } from '@/features/ops-hospitals/presentation/components/RejectDocumentModal';
import { RequestDocumentsModal } from '@/features/ops-hospitals/presentation/components/RequestDocumentsModal';
import { DocUploadButton } from '@/features/ops-hospitals/presentation/components/DocUploadButton';
import {
  DOC_BADGE,
  INVITE_BADGE,
  STAGE_BADGE,
  formatFileSize,
} from '@/features/ops-hospitals/presentation/components/onboarding.view';

const ADMIN_COLUMNS = ['Administrator', 'Role', 'Status', 'Invitation', 'Action'] as const;

/** Which dialog the panel has open. */
type PanelModal = 'invite' | 'docs' | 'golive' | null;

/** Hint per document status, so a row always says what happens next. */
function docHint(doc: OnboardingDoc): string {
  switch (doc.status) {
    case 'Requested':
      return 'Requested — nothing on file yet';
    case 'Uploaded':
      return `On file${doc.uploadedAt ? ` since ${longDateFromIso(doc.uploadedAt)}` : ''} · awaiting your decision`;
    case 'Approved':
      return `Approved by ${doc.reviewedBy ?? 'operations'}${doc.reviewedAt ? ` · ${doc.reviewedAt}` : ''}`;
    case 'Rejected':
      return `Rejected by ${doc.reviewedBy ?? 'operations'}${doc.reviewedAt ? ` · ${doc.reviewedAt}` : ''}`;
  }
}

interface OnboardingCasePanelProps {
  hospital: OpsHospital;
  onboarding: OnboardingCase;
}

/**
 * One hospital's onboarding case (audit SA-01): its administrator invitations,
 * its document checklist with a **per-document** Approve and Reject, and the
 * go-live gate that lists exactly what is still blocking.
 *
 * There is deliberately no "approve everything" control. The audit finding is
 * that KYC documents "cannot be uploaded or approved one by one", so each row
 * carries its own upload, its own decision, its own reviewer and timestamp,
 * and a rejection carries the reason the hospital is given.
 */
export function OnboardingCasePanel({ hospital, onboarding }: OnboardingCasePanelProps) {
  const navigate = useNavigate();
  const approveDoc = useOnboardingStore((s) => s.approveDoc);
  const uploadDoc = useOnboardingStore((s) => s.uploadDoc);
  const resendInvite = useOnboardingStore((s) => s.resendInvite);
  const markInviteAccepted = useOnboardingStore((s) => s.markInviteAccepted);
  const goLive = useOnboardingStore((s) => s.goLive);
  const [modal, setModal] = useState<PanelModal>(null);
  const [rejecting, setRejecting] = useState<OnboardingDocKey | null>(null);
  const [busy, run] = useOpsAct();

  const stage = stageOf(onboarding);
  const blockers = goLiveBlockers(onboarding);
  const progress = docProgress(onboarding);
  const live = Boolean(onboarding.liveAt);
  const ready = !live && blockers.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-blue-soft-bg text-text-navy flex size-13 flex-none items-center justify-center rounded-lg">
            <Icon name="building-2" size={24} />
          </div>
          <div className="flex min-w-50 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-3">
              <SectionTitle size={18}>{hospital.name}</SectionTitle>
              <Badge status={STAGE_BADGE[stage]}>{stage}</Badge>
            </div>
            <span className="text-caption text-text-muted">
              {hospital.email} · {hospital.city}
              {hospital.st ? `, ${hospital.st}` : ''} · applied{' '}
              {longDateFromIso(onboarding.startedAt)}
              {onboarding.liveAt ? ` · live ${longDateFromIso(onboarding.liveAt)}` : ''}
            </span>
          </div>
          <div className="flex-1"></div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="ghost" onClick={() => navigate(opsHospitalDetailPath(hospital.id))}>
              Hospital Profile
            </Button>
            <Button variant="secondary" icon="send" onClick={() => setModal('docs')}>
              {onboarding.docs.length === 0 ? 'Request Documents' : 'Update Checklist'}
            </Button>
            <Button variant="secondary" icon="user-plus" onClick={() => setModal('invite')}>
              Add Administrator
            </Button>
            {!live && (
              <span
                title={
                  ready
                    ? 'Take this hospital live on Medibook'
                    : 'Clear every blocker below before this hospital can go live'
                }
              >
                <Button icon="rocket" disabled={!ready} onClick={() => setModal('golive')}>
                  Go Live
                </Button>
              </span>
            )}
          </div>
        </div>
      </Card>

      <Card pad={16}>
        <div className="flex flex-wrap items-start gap-3.5">
          <div
            className={cn(
              'flex size-10 flex-none items-center justify-center rounded-md',
              live ? 'bg-g-100 text-g-600' : ready ? 'bg-g-100 text-g-600' : 'bg-y-100 text-y-600',
            )}
          >
            <Icon name={live ? 'rocket' : ready ? 'circle-check' : 'triangle-alert'} size={19} />
          </div>
          <div className="min-w-50 flex-1">
            <div className="text-body text-text-strong font-medium">
              {live
                ? `Live since ${longDateFromIso(onboarding.liveAt)}`
                : ready
                  ? 'Ready to go live — nothing is blocking'
                  : `${blockers.length} thing${blockers.length === 1 ? '' : 's'} still blocking go-live`}
            </div>
            <div className="text-caption text-text-muted">
              {progress.total === 0
                ? 'No required documents on the checklist yet'
                : `${progress.approved} of ${progress.total} required documents approved`}
            </div>
            {!live && blockers.length > 0 && (
              <ul className="mt-2.5 flex list-none flex-col gap-1.5 p-0">
                {blockers.map((b) => (
                  <li key={b} className="text-body text-text-body flex items-start gap-2">
                    <Icon name="circle-alert" size={15} className="text-y-600 mt-0.5 flex-none" />
                    {b}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <SectionTitle>Hospital Administrators</SectionTitle>
          <Button size="sm" variant="secondary" icon="user-plus" onClick={() => setModal('invite')}>
            Add Administrator
          </Button>
        </div>
        <div className="text-caption text-text-muted mb-3.5">
          The first administrator is created here and invited by email. Delivery is not wired up
          yet, so an invitation is recorded as{' '}
          <b className="text-text-strong font-medium">queued</b> until someone confirms it was
          accepted.
        </div>
        <TableShell
          columns={ADMIN_COLUMNS}
          scrollLabel="Hospital administrators"
          state={
            onboarding.admins.length === 0
              ? {
                  kind: 'empty',
                  icon: 'user-plus',
                  title: 'No administrator for this hospital yet.',
                  message:
                    'Nobody can sign in to the hospital instance until its first administrator exists.',
                  actionLabel: 'Create the first administrator',
                  onAction: () => setModal('invite'),
                }
              : undefined
          }
        >
          {onboarding.admins.map((a) => (
            <tr key={a.id}>
              <td className={tdClass}>
                <div className="text-body text-text-strong font-medium">{a.name}</div>
                <div className="text-caption text-text-muted">
                  {a.email} · {a.phone}
                </div>
              </td>
              <td className={tdClass}>{a.role}</td>
              <td className={tdClass}>
                <Badge status={INVITE_BADGE[a.status]}>{a.status}</Badge>
              </td>
              <td className={tdClass}>
                <div className="text-body text-text-body">
                  Queued {longDateFromIso(a.invitedAt)}
                </div>
                <div className="text-caption text-text-muted">
                  {a.status === 'Accepted' && a.acceptedAt
                    ? `Accepted ${a.acceptedAt}`
                    : `Last queued ${a.lastQueuedAt}${a.resends > 0 ? ` · ${a.resends} resend${a.resends === 1 ? '' : 's'}` : ''}`}
                </div>
              </td>
              <td className={tdClass}>
                <div className="flex gap-2">
                  <IconBtn
                    name="send"
                    label="Resend invitation"
                    box={36}
                    size={16}
                    disabled={a.status === 'Accepted'}
                    busy={busy[`resend${a.id}`]}
                    title={
                      a.status === 'Accepted'
                        ? 'Already accepted — nothing to resend'
                        : `Re-queue the invitation to ${a.email}`
                    }
                    onClick={() =>
                      run(`resend${a.id}`, `Invitation re-queued for ${a.email}.`, () =>
                        resendInvite(onboarding.hid, a.id),
                      )
                    }
                  />
                  <IconBtn
                    name="user-check"
                    label="Record invitation accepted"
                    box={36}
                    size={16}
                    disabled={a.status === 'Accepted'}
                    busy={busy[`accept${a.id}`]}
                    title={
                      a.status === 'Accepted'
                        ? `Accepted ${a.acceptedAt ?? ''}`
                        : `Record that ${a.name} has accepted and set their password`
                    }
                    onClick={() =>
                      run(`accept${a.id}`, `${a.name} recorded as accepted.`, () =>
                        markInviteAccepted(onboarding.hid, a.id),
                      )
                    }
                  />
                </div>
              </td>
            </tr>
          ))}
        </TableShell>
      </Card>

      <Card>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <SectionTitle>KYC Documents</SectionTitle>
          <Button size="sm" variant="secondary" icon="send" onClick={() => setModal('docs')}>
            {onboarding.docs.length === 0 ? 'Request Documents' : 'Update Checklist'}
          </Button>
        </div>
        <div className="text-caption text-text-muted mb-3.5">
          Every document is reviewed on its own: approve the ones that are right, reject the rest
          with a reason, and the hospital re-uploads only what failed.
        </div>
        {onboarding.docs.length === 0 ? (
          <EmptyState
            icon="file-text"
            title="No documents requested yet."
            message="Pick the checklist this hospital must provide — registration, GST, licence, bank proof and anything else its specialisation needs."
            actionLabel="Request documents"
            actionIcon="send"
            actionVariant="button"
            onAction={() => setModal('docs')}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {onboarding.docs.map((doc) => {
              const spec = ONBOARDING_DOC_CATALOG.find((s) => s.key === doc.key);
              return (
                <div
                  key={doc.key}
                  className={cn(
                    'flex flex-wrap items-center gap-3 rounded-md border px-3.5 py-3',
                    doc.status === 'Rejected' ? 'border-d-500' : 'border-border-soft',
                  )}
                >
                  <div
                    className={cn(
                      'flex size-9 flex-none items-center justify-center rounded-md',
                      doc.status === 'Approved'
                        ? 'bg-g-100 text-g-600'
                        : doc.status === 'Rejected'
                          ? 'bg-d-100 text-d-500'
                          : doc.status === 'Uploaded'
                            ? 'bg-y-100 text-y-600'
                            : 'bg-grey-300 text-text-muted',
                    )}
                  >
                    <Icon name="file-text" size={17} />
                  </div>
                  <div className="min-w-50 flex-1">
                    <div className="text-body text-text-strong flex flex-wrap items-center gap-2 font-medium">
                      {ONBOARDING_DOC_LABEL[doc.key]}
                      {!doc.required && (
                        <span className="text-caption text-text-muted font-normal">(optional)</span>
                      )}
                    </div>
                    <div className="text-caption text-text-muted">{docHint(doc)}</div>
                    {doc.fileName && (
                      <div className="text-caption text-text-body mt-0.5 flex items-center gap-1.5">
                        <Icon name="file-down" size={13} className="flex-none" />
                        <span className="truncate">{doc.fileName}</span>
                        <span className="text-text-muted tabular-nums">
                          {formatFileSize(doc.fileSize)}
                        </span>
                      </div>
                    )}
                    {doc.status === 'Rejected' && doc.rejectReason && (
                      <div className="text-caption text-d-700 mt-0.5">{doc.rejectReason}</div>
                    )}
                    {!doc.fileName && spec && (
                      <div className="text-caption text-text-faint mt-0.5">{spec.hint}</div>
                    )}
                  </div>
                  <Badge status={DOC_BADGE[doc.status]}>{doc.status}</Badge>
                  <div className="flex flex-none items-center gap-2">
                    <DocUploadButton
                      docLabel={ONBOARDING_DOC_LABEL[doc.key]}
                      hasFile={Boolean(doc.fileName)}
                      onUpload={(file) => {
                        uploadDoc(onboarding.hid, doc.key, file);
                        toast(
                          `${file.name} attached to ${ONBOARDING_DOC_LABEL[doc.key]}.`,
                          'success',
                        );
                      }}
                      onTooLarge={(mb) =>
                        toast(`That file is larger than ${mb} MB — nothing was attached.`, 'error')
                      }
                    />
                    <IconBtn
                      name="circle-check"
                      label="Approve document"
                      box={36}
                      size={16}
                      color="var(--color-g-600)"
                      disabled={doc.status !== 'Uploaded'}
                      busy={busy[`approve${doc.key}`]}
                      title={
                        doc.status === 'Uploaded'
                          ? `Approve ${ONBOARDING_DOC_LABEL[doc.key]}`
                          : doc.status === 'Approved'
                            ? 'Already approved'
                            : 'Nothing to approve — no file on record'
                      }
                      onClick={() =>
                        run(`approve${doc.key}`, `${ONBOARDING_DOC_LABEL[doc.key]} approved.`, () =>
                          approveDoc(onboarding.hid, doc.key),
                        )
                      }
                    />
                    <IconBtn
                      name="circle-x"
                      label="Reject document"
                      box={36}
                      size={16}
                      color="var(--color-d-500)"
                      disabled={doc.status === 'Requested'}
                      title={
                        doc.status === 'Requested'
                          ? 'Nothing to reject — no file on record'
                          : `Reject ${ONBOARDING_DOC_LABEL[doc.key]} with a reason`
                      }
                      onClick={() => setRejecting(doc.key)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {onboarding.requests.length > 0 && (
          <div className="border-border-soft mt-4 flex flex-col gap-2 border-t pt-3.5">
            <span className="text-label text-text-strong font-ui">Request history</span>
            {onboarding.requests.map((r) => (
              <div key={r.id} className="text-caption text-text-muted">
                {r.at} · {r.by} requested {r.keys.map((k) => ONBOARDING_DOC_LABEL[k]).join(', ')}
                {r.note ? ` · “${r.note}”` : ''}
              </div>
            ))}
          </div>
        )}
      </Card>

      {modal === 'invite' && (
        <AdminInviteModal
          open
          hid={onboarding.hid}
          hospitalName={hospital.name}
          defaultEmail={onboarding.admins.length === 0 ? hospital.email : ''}
          onClose={() => setModal(null)}
          onDone={() => setModal(null)}
        />
      )}
      {modal === 'docs' && (
        <RequestDocumentsModal
          open
          hospitalName={hospital.name}
          onboarding={onboarding}
          onClose={() => setModal(null)}
          onDone={() => setModal(null)}
        />
      )}
      {rejecting && (
        <RejectDocumentModal
          open
          hid={onboarding.hid}
          hospitalName={hospital.name}
          docKey={rejecting}
          onClose={() => setRejecting(null)}
          onDone={() => setRejecting(null)}
        />
      )}
      <OpsConfirm
        open={modal === 'golive'}
        onClose={() => setModal(null)}
        icon="rocket"
        tone="success"
        title="Take this hospital live?"
        body={`${hospital.name} starts serving patients on Medibook immediately, its instance becomes Active and its KYC is marked verified.`}
        summary={[
          { k: 'Documents approved', v: `${progress.approved} of ${progress.total}`, num: true },
          {
            k: 'Administrator',
            v: onboarding.admins.find((a) => a.status === 'Accepted')?.email ?? '—',
          },
          { k: 'Plan', v: hospital.plan },
        ]}
        confirmLabel={busy.golive ? 'Going live…' : 'Go Live'}
        busy={busy.golive}
        onConfirm={() =>
          run('golive', `${hospital.name} is live on Medibook.`, () => {
            if (!goLive(onboarding.hid)) {
              toast('Something is still blocking go-live — check the list again.', 'error');
            }
            setModal(null);
          })
        }
      />
    </div>
  );
}
