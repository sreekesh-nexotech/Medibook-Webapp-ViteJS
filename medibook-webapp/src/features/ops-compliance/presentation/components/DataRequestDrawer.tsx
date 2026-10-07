import { useFileDownloadMutation } from '@/shared/hooks/useFileDownloadMutation';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { CodeBlock } from '@/shared/ui/CodeBlock';
import { Drawer } from '@/shared/ui/Drawer';
import { ErrorState } from '@/shared/ui/ErrorState';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { Spinner } from '@/shared/ui/Spinner';
import { toast } from '@/shared/ui/toast/toast.store';

import { isFailure } from '@/core/error/failure';

import { useComplianceDataRequestQuery } from '@/features/ops-compliance/application/queries/useComplianceDataRequestQuery';
import type { DataRequest } from '@/features/ops-compliance/domain/entities/compliance.entities';
import {
  DATA_REQUEST_KIND_LABEL,
  DATA_REQUEST_LOOK,
  DATA_SUBJECT_LABEL,
  dataRequestActions,
  dataRequestNote,
  fmtComplianceDate,
  fmtComplianceWhen,
} from '@/features/ops-compliance/presentation/components/compliance.labels';

const NONE = '—';
const JSON_INDENT = 2;

interface DataRequestDrawerProps {
  /** The request to show; `null` keeps the drawer closed. */
  requestId: string | null;
  canEdit: boolean;
  busyId: string | null;
  onClose: () => void;
  onPrepare: (request: DataRequest) => void;
  onRectify: (request: DataRequest) => void;
  onReject: (request: DataRequest) => void;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-caption text-text-faint">{label}</span>
      <span className="text-body text-text-strong font-medium break-words">{value}</span>
    </div>
  );
}

function subjectLine(r: DataRequest): string {
  const who = r.subjectName ?? (r.subjectUserId ? `Account ${r.subjectUserId}` : 'No account');
  return r.subjectContact ? `${who} · ${r.subjectContact}` : who;
}

/**
 * One data-subject request in full (`GET …/data-requests/{id}`, 12·R12):
 * notes, the export's retention carve-out, the cooling-off end, and the
 * actions the backend accepts for it — nothing it would refuse.
 */
export function DataRequestDrawer({
  requestId,
  canEdit,
  busyId,
  onClose,
  onPrepare,
  onRectify,
  onReject,
}: DataRequestDrawerProps) {
  const detail = useComplianceDataRequestQuery(requestId);
  const download = useFileDownloadMutation();
  if (requestId === null) return null;
  const r = detail.data;

  const handleDownload = (req: DataRequest): void => {
    if (!req.exportFileId) return;
    download.mutate(
      { fileId: req.exportFileId, filename: `medibook-${req.requestNo.toLowerCase()}` },
      {
        onError: (error) =>
          toast(isFailure(error) ? error.message : 'The export file could not be opened.', 'error'),
      },
    );
  };

  const actions = r ? dataRequestActions(r, canEdit) : null;
  const busy = r !== undefined && busyId === r.id;

  return (
    <Drawer
      open
      onClose={onClose}
      width={560}
      title={r ? r.requestNo : 'Data request'}
      subtitle={
        r ? `${DATA_REQUEST_KIND_LABEL[r.kind]} · ${DATA_SUBJECT_LABEL[r.subjectKind]}` : undefined
      }
      footer={
        r && actions ? (
          <>
            {r.exportFileId && (
              <Button
                size="sm"
                variant="secondary"
                icon="download"
                busy={download.isPending}
                onClick={() => handleDownload(r)}
              >
                Download export
              </Button>
            )}
            {actions.canPrepare && (
              <Button size="sm" busy={busy} onClick={() => onPrepare(r)}>
                Prepare now
              </Button>
            )}
            {actions.canRectify && (
              <Button size="sm" busy={busy} onClick={() => onRectify(r)}>
                Mark rectified
              </Button>
            )}
            {actions.canReject && (
              <Button size="sm" variant="ghost" className="text-d-500" onClick={() => onReject(r)}>
                Reject
              </Button>
            )}
          </>
        ) : undefined
      }
    >
      {detail.isPending && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}
      {detail.isError && (
        <ErrorState
          title="This request didn't load."
          message={isFailure(detail.error) ? detail.error.message : undefined}
          onRetry={() => void detail.refetch()}
        />
      )}
      {r && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge status={DATA_REQUEST_LOOK[r.status].token}>
              {DATA_REQUEST_LOOK[r.status].label}
            </Badge>
            <span className="text-caption text-text-muted">{dataRequestNote(r)}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Fact label="Subject" value={subjectLine(r)} />
            <Fact label="Hospital" value={r.hospitalName ?? r.hospitalId ?? NONE} />
            <Fact
              label="Requested by"
              value={
                r.requestedByName ??
                (r.requestedByKind === 'self' ? 'The account holder' : 'Ops staff')
              }
            />
            <Fact label="Requested at" value={fmtComplianceWhen(r.requestedAt)} />
            <Fact label="Due" value={fmtComplianceDate(r.dueAt)} />
            <Fact
              label="Cooling-off ends"
              value={r.coolingOffEndsAt ? fmtComplianceWhen(r.coolingOffEndsAt) : NONE}
            />
            <Fact
              label="Completed at"
              value={r.completedAt ? fmtComplianceWhen(r.completedAt) : NONE}
            />
            <Fact label="Export file" value={r.exportFileId ? 'Prepared' : NONE} />
          </div>
          <div className="flex flex-col gap-2">
            <SectionTitle size={15}>Notes</SectionTitle>
            <p className="text-body text-text-body m-0 whitespace-pre-wrap">{r.notes ?? NONE}</p>
          </div>
          {r.retentionCarveOut !== null && (
            <div className="flex flex-col gap-2">
              <SectionTitle size={15}>Left out of the export</SectionTitle>
              <CodeBlock label="Retention carve-out">
                {JSON.stringify(r.retentionCarveOut, null, JSON_INDENT)}
              </CodeBlock>
              <span className="text-caption text-text-muted">
                Medical documents and insurance are never exported (Q123).
              </span>
            </div>
          )}
          {r.kind === 'deletion' && (
            <p className="text-caption text-text-muted bg-blue-soft-bg m-0 rounded-sm px-3 py-2.5">
              Account deletions follow the patient&apos;s own request and complete automatically
              when the 30-day cooling-off ends; signing in during it cancels the deletion. The
              console cannot reject or speed them up.
            </p>
          )}
        </div>
      )}
    </Drawer>
  );
}
