import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { opsPath } from '@/app/router/paths';

import { isFailure } from '@/core/error/failure';

import { useFileDownloadMutation } from '@/shared/hooks/useFileDownloadMutation';
import { cn } from '@/shared/lib/cn';
import { fmtDate } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Icon } from '@/shared/ui/Icon';
import { IconBtn } from '@/shared/ui/IconBtn';
import { OpsConfirm } from '@/shared/ui/OpsConfirm';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { Select } from '@/shared/ui/Select';
import { SkeletonCards } from '@/shared/ui/Skeleton';
import { toast } from '@/shared/ui/toast/toast.store';

import type {
  ChecklistItem,
  ChecklistUpdate,
  OnboardingCaseSummary,
} from '@/features/ops-hospitals/domain/entities/onboarding.entity';
import { useHospitalQuery } from '@/features/ops-hospitals/application/queries/useHospitalQuery';
import { useApproveHospitalMutation } from '@/features/ops-hospitals/application/queries/useApproveHospitalMutation';
import { useGoLiveMutation } from '@/features/ops-hospitals/application/queries/useGoLiveMutation';
import { useOnboardingCaseQuery } from '@/features/ops-hospitals/application/queries/useOnboardingCaseQuery';
import { useRejectOnboardingCaseMutation } from '@/features/ops-hospitals/application/queries/useRejectOnboardingCaseMutation';
import { useSetOnboardingStageMutation } from '@/features/ops-hospitals/application/queries/useSetOnboardingStageMutation';
import { useUpdateChecklistItemMutation } from '@/features/ops-hospitals/application/queries/useUpdateChecklistItemMutation';
import { useUploadKycScanMutation } from '@/features/ops-hospitals/application/queries/useUploadKycScanMutation';
import { DocUploadButton } from '@/features/ops-hospitals/presentation/components/DocUploadButton';
import {
  CHECKLIST_LABEL,
  CHECKLIST_PILL,
  CHECKLIST_TINT,
  MANUAL_STAGES,
  NO_ADMIN_BLOCKER,
  REJECT_APPLICATION_REASONS,
  SEND_BACK_REASONS,
  STAGE_LABEL,
  STAGE_PILL,
  blockerCopy,
  isManualStage,
} from '@/features/ops-hospitals/presentation/components/onboarding.status';
import { RejectDocumentModal } from '@/features/ops-hospitals/presentation/components/RejectDocumentModal';
import { RequestDocumentsModal } from '@/features/ops-hospitals/presentation/components/RequestDocumentsModal';

const FALLBACK_ERROR = 'Something went wrong. Please try again.';

/** Which dialog the panel has open. */
type PanelModal = 'docs' | 'golive' | 'reject' | null;

function errorCopy(error: unknown): string {
  return isFailure(error) ? error.message : FALLBACK_ERROR;
}

/** ISO timestamp → "12 Oct 2026"; empty for none. */
function dateCopy(iso: string | null): string {
  return iso ? fmtDate(iso.slice(0, 10)) : '';
}

/** What happens next for a checklist row, in one line. */
function itemHint(item: ChecklistItem): string {
  switch (item.status) {
    case 'pending':
      return item.note ? 'Sent back — waiting for a corrected document' : 'Not collected yet';
    case 'received':
      return `Received${item.receivedAt ? ` ${dateCopy(item.receivedAt)}` : ''} · waiting to be verified`;
    case 'verified':
      return `Verified${item.verifiedAt ? ` ${dateCopy(item.verifiedAt)}` : ''}`;
    case 'waived':
      return `Waived${item.verifiedAt ? ` ${dateCopy(item.verifiedAt)}` : ''} — not needed for go-live`;
  }
}

interface OnboardingCasePanelProps {
  summary: OnboardingCaseSummary;
}

/**
 * One hospital's onboarding case (audit SA-01, P3): its go-live blockers, the
 * administrator status, and the physical-document checklist with a
 * per-document decision. Documents are handed over in person (backend Q66),
 * so each row is ticked received → verified (or waived), optionally with a
 * scan attached, and can be sent back with a reason. Approve, reject and
 * go-live act on the whole application.
 *
 * There is deliberately no "verify everything" control: each document carries
 * its own decision and timestamp.
 */
export function OnboardingCasePanel({ summary }: OnboardingCasePanelProps) {
  const navigate = useNavigate();
  const caseQuery = useOnboardingCaseQuery(summary.id);
  const hospitalQuery = useHospitalQuery(summary.hospitalId);

  const updateItem = useUpdateChecklistItemMutation();
  const uploadScan = useUploadKycScanMutation();
  const setStage = useSetOnboardingStageMutation();
  const rejectCase = useRejectOnboardingCaseMutation();
  const approve = useApproveHospitalMutation();
  const goLive = useGoLiveMutation();
  const downloadScan = useFileDownloadMutation();

  const [modal, setModal] = useState<PanelModal>(null);
  const [sendingBack, setSendingBack] = useState<ChecklistItem | null>(null);
  const [uploadingCode, setUploadingCode] = useState<string | null>(null);

  if (caseQuery.isPending) return <SkeletonCards count={3} lines={4} />;

  if (caseQuery.isError) {
    return (
      <ErrorState
        title="This application didn't load"
        message={errorCopy(caseQuery.error)}
        onRetry={() => void caseQuery.refetch()}
      />
    );
  }

  const detail = caseQuery.data;
  const hospital = hospitalQuery.data;
  const stage = detail.stage;
  const live = stage === 'live';
  const closed = live || stage === 'rejected';
  const blockers = detail.blockers;
  const ready = !closed && blockers.length === 0;
  const adminAccepted = !blockers.some((b) => b.code === NO_ADMIN_BLOCKER);
  const settled = detail.checklist.filter(
    (i) => i.status === 'verified' || i.status === 'waived',
  ).length;
  const total = detail.checklist.length;
  const planCode = hospital?.subscription?.planCode ?? '—';

  const tick = (item: ChecklistItem, update: ChecklistUpdate, done: string): void => {
    updateItem.mutate(
      { caseId: detail.id, code: item.code, update },
      {
        onSuccess: () => toast(done, 'success'),
        onError: (error) => toast(errorCopy(error), 'error'),
      },
    );
  };

  const attachScan = (item: ChecklistItem, file: File): void => {
    setUploadingCode(item.code);
    uploadScan.mutate(file, {
      onSuccess: (fileId) =>
        tick(
          item,
          { status: item.status === 'verified' ? 'verified' : 'received', fileId },
          `Scan attached to ${item.name}.`,
        ),
      onError: (error) => toast(errorCopy(error), 'error'),
      onSettled: () => setUploadingCode(null),
    });
  };

  const sendBack = async (reason: string): Promise<boolean> => {
    if (!sendingBack) return false;
    try {
      await updateItem.mutateAsync({
        caseId: detail.id,
        code: sendingBack.code,
        update: { status: 'pending', note: reason },
      });
      toast(`${sendingBack.name} sent back to ${detail.hospitalName}.`, 'info');
      return true;
    } catch (error) {
      toast(errorCopy(error), 'error');
      return false;
    }
  };

  const rejectApplication = async (reason: string): Promise<boolean> => {
    try {
      await rejectCase.mutateAsync({ caseId: detail.id, reason });
      toast(`${detail.hospitalName}'s application was rejected.`, 'info');
      return true;
    } catch (error) {
      toast(errorCopy(error), 'error');
      return false;
    }
  };

  const approveCase = (): void => {
    approve.mutate(detail.hospitalId, {
      onSuccess: () => toast(`${detail.hospitalName} approved — waiting on go-live.`, 'success'),
      onError: (error) => toast(errorCopy(error), 'error'),
    });
  };

  const confirmGoLive = (): void => {
    goLive.mutate(detail.hospitalId, {
      onSuccess: () => {
        toast(`${detail.hospitalName} is live on Medibook.`, 'success');
        setModal(null);
      },
      onError: (error) => {
        toast(errorCopy(error), 'error');
        setModal(null);
      },
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-blue-soft-bg text-text-navy flex size-13 flex-none items-center justify-center rounded-lg">
            <Icon name="building-2" size={24} />
          </div>
          <div className="flex min-w-50 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-3">
              <SectionTitle size={18}>{detail.hospitalName}</SectionTitle>
              <Badge status={STAGE_PILL[stage]}>{STAGE_LABEL[stage]}</Badge>
            </div>
            <span className="text-caption text-text-muted">
              {hospital
                ? `${hospital.email} · ${hospital.city}${hospital.state ? `, ${hospital.state}` : ''} · plan ${planCode}`
                : hospitalQuery.isError
                  ? 'Hospital details unavailable'
                  : 'Loading hospital details…'}
              {detail.submittedAt ? ` · applied ${dateCopy(detail.submittedAt)}` : ''}
              {detail.approvedAt ? ` · approved ${dateCopy(detail.approvedAt)}` : ''}
              {live && hospital?.goLiveAt ? ` · live ${dateCopy(hospital.goLiveAt)}` : ''}
            </span>
          </div>
          <div className="flex-1"></div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => navigate(`${opsPath('hospitals')}/${detail.hospitalId}`)}
            >
              Hospital Profile
            </Button>
            {isManualStage(stage) && (
              <div className="w-48">
                <Select
                  value={STAGE_LABEL[stage]}
                  options={MANUAL_STAGES.map((s) => STAGE_LABEL[s])}
                  onChange={(label) => {
                    const next = MANUAL_STAGES.find((s) => STAGE_LABEL[s] === label);
                    if (!next || next === stage) return;
                    setStage.mutate(
                      { caseId: detail.id, stage: next },
                      {
                        onSuccess: () => toast(`Moved to ${STAGE_LABEL[next]}.`, 'success'),
                        onError: (error) => toast(errorCopy(error), 'error'),
                      },
                    );
                  }}
                  height={40}
                  aria-label="Onboarding stage"
                  disabled={setStage.isPending}
                />
              </div>
            )}
            {!closed && stage !== 'approved' && (
              <Button
                variant="secondary"
                icon="circle-check"
                busy={approve.isPending}
                onClick={approveCase}
              >
                Approve
              </Button>
            )}
            {!closed && (
              <Button variant="secondary" icon="circle-x" onClick={() => setModal('reject')}>
                Reject
              </Button>
            )}
            {!closed && (
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

      {stage === 'rejected' && (
        <Card pad={16} className="flex items-start gap-3">
          <Icon name="circle-x" size={18} className="text-d-500 mt-0.5 flex-none" />
          <div className="text-body text-text-body">
            <span className="text-text-strong font-medium">Application rejected.</span>{' '}
            {detail.rejectionReason ?? 'No reason was recorded.'}
          </div>
        </Card>
      )}

      {stage !== 'rejected' && (
        <Card pad={16}>
          <div className="flex flex-wrap items-start gap-3.5">
            <div
              className={cn(
                'flex size-10 flex-none items-center justify-center rounded-md',
                live || ready ? 'bg-g-100 text-g-600' : 'bg-y-100 text-y-600',
              )}
            >
              <Icon name={live ? 'rocket' : ready ? 'circle-check' : 'triangle-alert'} size={19} />
            </div>
            <div className="min-w-50 flex-1">
              <div className="text-body text-text-strong font-medium">
                {live
                  ? 'Live on Medibook'
                  : ready
                    ? 'Ready to go live — nothing is blocking'
                    : `${blockers.length} thing${blockers.length === 1 ? '' : 's'} still blocking go-live`}
              </div>
              <div className="text-caption text-text-muted">
                {total === 0
                  ? 'Nothing on the document checklist'
                  : `${settled} of ${total} checklist documents verified or waived`}
              </div>
              {!live && blockers.length > 0 && (
                <ul className="mt-2.5 flex list-none flex-col gap-1.5 p-0">
                  {blockers.map((b) => (
                    <li key={b.code} className="text-body text-text-body flex items-start gap-2">
                      <Icon name="circle-alert" size={15} className="text-y-600 mt-0.5 flex-none" />
                      {blockerCopy(b, detail.checklist)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle>Hospital Administrator</SectionTitle>
        <div className="mt-3 flex items-start gap-3">
          <div
            className={cn(
              'flex size-9 flex-none items-center justify-center rounded-md',
              adminAccepted ? 'bg-g-100 text-g-600' : 'bg-y-100 text-y-600',
            )}
          >
            <Icon name={adminAccepted ? 'user-check' : 'user-plus'} size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-body text-text-strong font-medium">
              {adminAccepted
                ? 'An administrator has accepted the invitation'
                : 'Waiting for the first administrator to accept'}
            </div>
            <div className="text-caption text-text-muted">
              The first administrator is invited when the hospital is created. Inviting, resending
              or adding administrators from the console is not yet available from the server.
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <SectionTitle>KYC Documents</SectionTitle>
          {!closed && (
            <Button size="sm" variant="secondary" icon="send" onClick={() => setModal('docs')}>
              Update Checklist
            </Button>
          )}
        </div>
        <div className="text-caption text-text-muted mb-3.5">
          Documents are collected from the hospital in person. Tick each one as received, attach a
          scan if you have one, then verify it — or waive it, or send it back with a reason.
        </div>
        {total === 0 ? (
          <EmptyState
            icon="file-text"
            title="Nothing on the checklist."
            message="Add the documents this hospital must provide from the platform catalogue."
            actionLabel={closed ? undefined : 'Update checklist'}
            actionIcon="send"
            actionVariant="button"
            onAction={closed ? undefined : () => setModal('docs')}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {detail.checklist.map((item) => (
              <div
                key={item.code}
                className={cn(
                  'flex flex-wrap items-center gap-3 rounded-md border px-3.5 py-3',
                  item.status === 'pending' && item.note ? 'border-d-500' : 'border-border-soft',
                )}
              >
                <div
                  className={cn(
                    'flex size-9 flex-none items-center justify-center rounded-md',
                    CHECKLIST_TINT[item.status],
                  )}
                >
                  <Icon name="file-text" size={17} />
                </div>
                <div className="min-w-50 flex-1">
                  <div className="text-body text-text-strong font-medium">{item.name}</div>
                  <div className="text-caption text-text-muted">{itemHint(item)}</div>
                  {item.fileId && (
                    <button
                      type="button"
                      onClick={() =>
                        item.fileId &&
                        downloadScan.mutate(
                          { fileId: item.fileId },
                          { onError: (error) => toast(errorCopy(error), 'error') },
                        )
                      }
                      className="text-caption text-blue mt-0.5 flex cursor-pointer items-center gap-1.5 border-none bg-transparent p-0"
                    >
                      <Icon name="file-down" size={13} className="flex-none" /> Download scan
                    </button>
                  )}
                  {item.note && (
                    <div
                      className={cn(
                        'text-caption mt-0.5',
                        item.status === 'pending' ? 'text-d-700' : 'text-text-muted',
                      )}
                    >
                      {item.note}
                    </div>
                  )}
                </div>
                <Badge status={CHECKLIST_PILL[item.status]}>{CHECKLIST_LABEL[item.status]}</Badge>
                {!closed && (
                  <div className="flex flex-none items-center gap-2">
                    <DocUploadButton
                      docLabel={item.name}
                      hasFile={item.fileId !== null}
                      busy={uploadingCode === item.code}
                      disabled={uploadScan.isPending || item.status === 'waived'}
                      onUpload={(file) => attachScan(item, file)}
                      onTooLarge={(mb) =>
                        toast(`That file is larger than ${mb} MB — nothing was attached.`, 'error')
                      }
                    />
                    <IconBtn
                      name="check-check"
                      label="Mark received"
                      box={36}
                      size={16}
                      disabled={item.status !== 'pending' || updateItem.isPending}
                      title={
                        item.status === 'pending'
                          ? `Mark ${item.name} received (no scan)`
                          : 'Already received'
                      }
                      onClick={() =>
                        tick(item, { status: 'received' }, `${item.name} marked received.`)
                      }
                    />
                    <IconBtn
                      name="circle-check"
                      label="Verify document"
                      box={36}
                      size={16}
                      color="var(--color-g-600)"
                      disabled={item.status !== 'received' || updateItem.isPending}
                      title={
                        item.status === 'received'
                          ? `Verify ${item.name}`
                          : item.status === 'verified'
                            ? 'Already verified'
                            : 'Mark it received first'
                      }
                      onClick={() => tick(item, { status: 'verified' }, `${item.name} verified.`)}
                    />
                    <IconBtn
                      name="circle-slash"
                      label="Waive document"
                      box={36}
                      size={16}
                      disabled={
                        item.status === 'verified' ||
                        item.status === 'waived' ||
                        updateItem.isPending
                      }
                      title={
                        item.status === 'waived'
                          ? 'Already waived'
                          : `Waive ${item.name} — it no longer blocks go-live`
                      }
                      onClick={() => tick(item, { status: 'waived' }, `${item.name} waived.`)}
                    />
                    <IconBtn
                      name="undo-2"
                      label="Send document back"
                      box={36}
                      size={16}
                      color="var(--color-d-500)"
                      disabled={item.status === 'pending' || updateItem.isPending}
                      title={
                        item.status === 'pending'
                          ? 'Nothing to send back yet'
                          : `Send ${item.name} back with a reason`
                      }
                      onClick={() => setSendingBack(item)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {modal === 'docs' && (
        <RequestDocumentsModal
          open
          caseId={detail.id}
          hospitalName={detail.hospitalName}
          existingCodes={detail.checklist.map((i) => i.code)}
          onClose={() => setModal(null)}
        />
      )}
      {sendingBack && (
        <RejectDocumentModal
          open
          title={`Send ${sendingBack.name} back?`}
          reasons={SEND_BACK_REASONS}
          submitLabel="Send Back"
          info={`The document returns to pending with your reason. The rest of the checklist keeps its own status.`}
          notePlaceholder="e.g. The GST certificate is registered to a different entity"
          onClose={() => setSendingBack(null)}
          onSubmit={sendBack}
        />
      )}
      {modal === 'reject' && (
        <RejectDocumentModal
          open
          title={`Reject ${detail.hospitalName}'s application?`}
          reasons={REJECT_APPLICATION_REASONS}
          submitLabel="Reject Application"
          info="The case closes as rejected and the reason is recorded. The hospital does not go live."
          notePlaceholder="e.g. The registration certificate could not be verified with the state"
          onClose={() => setModal(null)}
          onSubmit={rejectApplication}
        />
      )}
      <OpsConfirm
        open={modal === 'golive'}
        onClose={() => setModal(null)}
        icon="rocket"
        tone="success"
        title="Take this hospital live?"
        body={`${detail.hospitalName} starts serving patients on Medibook immediately and its instance becomes Active.`}
        summary={[
          { k: 'Checklist', v: `${settled} of ${total} verified or waived`, num: true },
          { k: 'Administrator', v: adminAccepted ? 'Accepted' : 'Not accepted' },
          { k: 'Plan', v: planCode },
        ]}
        confirmLabel={goLive.isPending ? 'Going live…' : 'Go Live'}
        busy={goLive.isPending}
        onConfirm={confirmGoLive}
      />
    </div>
  );
}
