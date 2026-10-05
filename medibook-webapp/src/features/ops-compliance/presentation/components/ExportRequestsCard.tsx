import { useState } from 'react';

import { useFileDownloadMutation } from '@/shared/hooks/useFileDownloadMutation';
import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { OpsEntity } from '@/shared/ui/OpsEntity';
import { Pager } from '@/shared/ui/Pager';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { toast } from '@/shared/ui/toast/toast.store';

import { isFailure } from '@/core/error/failure';

import { useComplianceDataRequestsQuery } from '@/features/ops-compliance/application/queries/useComplianceDataRequestsQuery';
import { useRejectComplianceDataRequestMutation } from '@/features/ops-compliance/application/queries/useRejectComplianceDataRequestMutation';
import type {
  DataRequest,
  DataSubjectKind,
} from '@/features/ops-compliance/domain/entities/compliance.entities';
import { RejectDataRequestModal } from '@/features/ops-compliance/presentation/components/RejectDataRequestModal';
import {
  DATA_REQUEST_LOOK,
  OPEN_DATA_REQUEST_STATUSES,
  fmtComplianceDate,
  fmtComplianceWhen,
} from '@/features/ops-compliance/presentation/components/compliance.labels';

const PAGE_SIZE = 10;

const COLUMNS = [
  'Request',
  'Subject',
  'Requested by',
  'Requested at',
  'Due',
  'Status',
  '',
] as const;

const SUBJECT_LABELS: Readonly<Record<DataSubjectKind, string>> = {
  patient: 'Patient account',
  hospital_staff: 'Hospital staff account',
  hospital: 'Hospital',
};

/** Leading characters of an account id shown when no name is available. */
const ID_PREVIEW_CHARS = 8;

const KIND_LABELS: Readonly<Record<DataRequest['kind'], string>> = {
  export: 'Export',
  deletion: 'Deletion',
  rectification: 'Rectification',
  percent: 'Request',
};

/** What to say under the status badge. */
function statusNote(r: DataRequest): string {
  if (r.status === 'completed') return r.exportFileId ? 'File ready to download' : 'Closed';
  if (r.status === 'no_data') return 'No records held — nothing was written';
  if (r.status === 'rejected') return r.notes ?? 'Rejected';
  if (OPEN_DATA_REQUEST_STATUSES.has(r.status)) return 'The nightly run prepares it if not now';
  return '';
}

interface ExportRequestsCardProps {
  /** The request being prepared right now, so its row shows busy. */
  processingId: string | null;
  onProcess: (request: DataRequest) => void;
}

/**
 * The data-subject request register (`GET /platform/compliance/
 * data-requests`), newest first.
 *
 * THE LAW, made visible: a request shows its real status — Requested while
 * waiting, Completed with a downloadable file only once the server wrote one,
 * No data when the account held nothing. Open requests can be prepared now
 * or rejected with a reason.
 */
export function ExportRequestsCard({ processingId, onProcess }: ExportRequestsCardProps) {
  const [page, setPage] = useState(0);
  const [rejecting, setRejecting] = useState<DataRequest | null>(null);
  const requestsQuery = useComplianceDataRequestsQuery({ page: page + 1, pageSize: PAGE_SIZE });
  const rejectMutation = useRejectComplianceDataRequestMutation();
  const download = useFileDownloadMutation();

  const requests = requestsQuery.data?.items ?? [];

  const handleDownload = (r: DataRequest): void => {
    if (!r.exportFileId) return;
    download.mutate(
      { fileId: r.exportFileId, filename: `medibook-${r.requestNo.toLowerCase()}` },
      {
        onError: (error) =>
          toast(isFailure(error) ? error.message : 'The export file could not be opened.', 'error'),
      },
    );
  };

  const handleReject = (reason: string): void => {
    if (!rejecting) return;
    const { id, requestNo } = rejecting;
    rejectMutation.mutate(
      { id, reason },
      {
        onSuccess: () => {
          toast(`${requestNo} rejected.`, 'success');
          setRejecting(null);
        },
        onError: (error) =>
          toast(isFailure(error) ? error.message : 'The request could not be rejected.', 'error'),
      },
    );
  };

  const tableState: TableStateSpec | undefined = requestsQuery.isLoading
    ? { kind: 'loading', rows: PAGE_SIZE }
    : requestsQuery.isError
      ? {
          kind: 'error',
          title: "Recorded requests didn't load.",
          message: isFailure(requestsQuery.error) ? requestsQuery.error.message : undefined,
          onRetry: () => void requestsQuery.refetch(),
        }
      : requests.length === 0
        ? {
            kind: 'empty',
            icon: 'file-down',
            title: 'No data-subject requests yet.',
            message:
              'Requests you prepare above — and those patients file themselves — are recorded here with their status and due date.',
          }
        : undefined;

  return (
    <Card>
      <SectionTitle className="mb-4">Recorded Requests</SectionTitle>
      <TableShell columns={COLUMNS} scrollLabel="Recorded data-subject requests" state={tableState}>
        {requests.map((r) => {
          const look = DATA_REQUEST_LOOK[r.status];
          const isOpen = OPEN_DATA_REQUEST_STATUSES.has(r.status);
          const canPrepare = isOpen && r.kind === 'export';
          return (
            <tr key={r.id}>
              <td className={cn(tdClass, 'whitespace-nowrap')}>
                <OpsEntity
                  icon="file-down"
                  tint={r.status === 'completed' ? 'success' : isOpen ? 'warning' : 'neutral'}
                  title={r.requestNo}
                  sub={KIND_LABELS[r.kind]}
                />
              </td>
              <td className={cn(tdClass, 'max-w-80')} title={r.subjectUserId ?? undefined}>
                <div className="flex flex-col">
                  <span>{SUBJECT_LABELS[r.subjectKind]}</span>
                  {r.subjectUserId && (
                    <span className="text-caption text-text-muted tabular-nums">
                      {r.subjectUserId.slice(0, ID_PREVIEW_CHARS)}…
                    </span>
                  )}
                </div>
              </td>
              <td className={tdClass}>
                {r.requestedByKind === 'self' ? 'The account holder' : 'Ops staff'}
              </td>
              <td className={cn(tdClass, 'whitespace-nowrap tabular-nums')}>
                {fmtComplianceWhen(r.requestedAt)}
              </td>
              <td className={cn(tdClass, 'whitespace-nowrap tabular-nums')}>
                {fmtComplianceDate(r.dueAt)}
              </td>
              <td className={tdClass}>
                <div className="flex flex-col items-start gap-1">
                  <Badge status={look.token}>{look.label}</Badge>
                  <span className="text-caption text-text-muted">{statusNote(r)}</span>
                </div>
              </td>
              <td className={tdClass}>
                <div className="flex gap-2">
                  {r.exportFileId && (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon="download"
                      busy={download.isPending && download.variables.fileId === r.exportFileId}
                      onClick={() => handleDownload(r)}
                    >
                      Download
                    </Button>
                  )}
                  {canPrepare && (
                    <Button
                      size="sm"
                      busy={processingId === r.id}
                      disabled={processingId != null && processingId !== r.id}
                      onClick={() => onProcess(r)}
                    >
                      Prepare now
                    </Button>
                  )}
                  {isOpen && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-d-500"
                      onClick={() => setRejecting(r)}
                    >
                      Reject
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </TableShell>
      <Pager
        total={requestsQuery.data?.total ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        onPage={setPage}
        noun="requests"
      />
      {rejecting && (
        <RejectDataRequestModal
          requestNo={rejecting.requestNo}
          busy={rejectMutation.isPending}
          onClose={() => setRejecting(null)}
          onReject={handleReject}
        />
      )}
    </Card>
  );
}
