import { useState } from 'react';

import { useOpsPermission } from '@/shared/hooks/useOpsPermission';
import { useFileDownloadMutation } from '@/shared/hooks/useFileDownloadMutation';
import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { OpsEntity } from '@/shared/ui/OpsEntity';
import { Pager } from '@/shared/ui/Pager';
import { SearchField } from '@/shared/ui/SearchField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { toast } from '@/shared/ui/toast/toast.store';

import { isFailure } from '@/core/error/failure';

import { useComplianceDataRequestsQuery } from '@/features/ops-compliance/application/queries/useComplianceDataRequestsQuery';
import { useProcessComplianceDataRequestMutation } from '@/features/ops-compliance/application/queries/useProcessComplianceDataRequestMutation';
import { useRejectComplianceDataRequestMutation } from '@/features/ops-compliance/application/queries/useRejectComplianceDataRequestMutation';
import {
  DATA_REQUEST_KINDS,
  DATA_REQUEST_STATUSES,
  DATA_SUBJECT_KINDS,
  type DataRequest,
  type DataRequestKind,
  type DataRequestStatus,
  type DataSubjectKind,
} from '@/features/ops-compliance/domain/entities/compliance.entities';
import { ComplianceDateInput } from '@/features/ops-compliance/presentation/components/ComplianceDateInput';
import { DataRequestDrawer } from '@/features/ops-compliance/presentation/components/DataRequestDrawer';
import { RectifyDataRequestModal } from '@/features/ops-compliance/presentation/components/RectifyDataRequestModal';
import { RejectDataRequestModal } from '@/features/ops-compliance/presentation/components/RejectDataRequestModal';
import {
  DATA_REQUEST_KIND_LABEL,
  DATA_REQUEST_LOOK,
  DATA_SUBJECT_LABEL,
  dataRequestActions,
  dataRequestNote,
  fmtComplianceDate,
  fmtComplianceWhen,
} from '@/features/ops-compliance/presentation/components/compliance.labels';
import { useComplianceDebouncedValue } from '@/features/ops-compliance/presentation/hooks/useComplianceDebouncedValue';

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

/** Leading characters of an account id shown when no name is available. */
const ID_PREVIEW_CHARS = 8;

const ALL_STATUSES = 'Status: All';
const ALL_KINDS = 'Type: All';
const ALL_SUBJECTS = 'Subject: All';

/** Typing pause before the request number is sent. */
const SEARCH_DEBOUNCE_MS = 350;

interface ExportRequestsCardProps {
  /** The request being prepared right now, so its row shows busy. */
  processingId: string | null;
  onProcess: (request: DataRequest) => void;
}

/**
 * The data-subject request register (`GET /platform/compliance/
 * data-requests`), newest first, filterable by status, type and subject
 * (12·R12).
 *
 * THE LAW, made visible: a request shows its real status — Requested while
 * waiting, Completed with a downloadable file only once the server wrote one,
 * No data when the account held nothing. Each row offers only what the
 * backend accepts for it (UAT-54): exports can be prepared, rectifications
 * marked done with notes, and open non-deletion requests rejected. Account
 * deletions in cooling-off complete on their own.
 */
export function ExportRequestsCard({ processingId, onProcess }: ExportRequestsCardProps) {
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<DataRequestStatus | null>(null);
  const [kind, setKind] = useState<DataRequestKind | null>(null);
  const [subjectKind, setSubjectKind] = useState<DataSubjectKind | null>(null);
  const [requestNo, setRequestNo] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const debouncedRequestNo = useComplianceDebouncedValue(requestNo.trim(), SEARCH_DEBOUNCE_MS);
  const [openId, setOpenId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<DataRequest | null>(null);
  const [rectifying, setRectifying] = useState<DataRequest | null>(null);
  // SEC-05: preparing, rectifying or rejecting a data request needs compliance.edit.
  const canEdit = useOpsPermission().can('compliance.edit');
  const requestsQuery = useComplianceDataRequestsQuery({
    page: page + 1,
    pageSize: PAGE_SIZE,
    statuses: status ? [status] : [],
    kind,
    subjectKind,
    requestNo: debouncedRequestNo,
    dateFrom,
    dateTo,
  });
  const rejectMutation = useRejectComplianceDataRequestMutation();
  const processMutation = useProcessComplianceDataRequestMutation();
  const download = useFileDownloadMutation();

  const requests = requestsQuery.data?.items ?? [];
  const filtersActive =
    status !== null ||
    kind !== null ||
    subjectKind !== null ||
    requestNo.trim() !== '' ||
    dateFrom !== '' ||
    dateTo !== '';
  const clearFilters = (): void => {
    setStatus(null);
    setKind(null);
    setSubjectKind(null);
    setRequestNo('');
    setDateFrom('');
    setDateTo('');
    setPage(0);
  };

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

  const handleRectify = (notes: string): void => {
    if (!rectifying) return;
    const { id, requestNo } = rectifying;
    processMutation.mutate(
      { id, notes },
      {
        onSuccess: () => {
          toast(`${requestNo} marked rectified.`, 'success');
          setRectifying(null);
        },
        onError: (error) =>
          toast(
            isFailure(error) ? error.message : 'The request could not be marked rectified.',
            'error',
          ),
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
            title: filtersActive
              ? 'No requests match these filters.'
              : 'No data-subject requests yet.',
            message: filtersActive
              ? 'Clear the filters to see the whole register.'
              : 'Requests you prepare above — and those patients file themselves — are recorded here with their status and due date.',
            ...(filtersActive ? { actionLabel: 'Clear filters', onAction: clearFilters } : {}),
          }
        : undefined;

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SectionTitle>Recorded Requests</SectionTitle>
        <div className="flex-1"></div>
        <FilterSelect
          value={status ? DATA_REQUEST_LOOK[status].label : ALL_STATUSES}
          aria-label="Filter by status"
          options={[ALL_STATUSES, ...DATA_REQUEST_STATUSES.map((s) => DATA_REQUEST_LOOK[s].label)]}
          onChange={(v) => {
            setStatus(DATA_REQUEST_STATUSES.find((s) => DATA_REQUEST_LOOK[s].label === v) ?? null);
            setPage(0);
          }}
        />
        <FilterSelect
          value={kind ? DATA_REQUEST_KIND_LABEL[kind] : ALL_KINDS}
          aria-label="Filter by request type"
          options={[ALL_KINDS, ...DATA_REQUEST_KINDS.map((k) => DATA_REQUEST_KIND_LABEL[k])]}
          onChange={(v) => {
            setKind(DATA_REQUEST_KINDS.find((k) => DATA_REQUEST_KIND_LABEL[k] === v) ?? null);
            setPage(0);
          }}
        />
        <FilterSelect
          value={subjectKind ? DATA_SUBJECT_LABEL[subjectKind] : ALL_SUBJECTS}
          aria-label="Filter by subject"
          options={[ALL_SUBJECTS, ...DATA_SUBJECT_KINDS.map((k) => DATA_SUBJECT_LABEL[k])]}
          onChange={(v) => {
            setSubjectKind(DATA_SUBJECT_KINDS.find((k) => DATA_SUBJECT_LABEL[k] === v) ?? null);
            setPage(0);
          }}
        />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-72">
          <SearchField
            value={requestNo}
            onChange={(v) => {
              setRequestNo(v);
              setPage(0);
            }}
            placeholder="Request no., e.g. DSR-2026-000004"
            aria-label="Find a request by its exact number"
          />
        </div>
        <ComplianceDateInput
          value={dateFrom}
          onChange={(v) => {
            setDateFrom(v);
            setPage(0);
          }}
          title="Requested on or after (IST)"
        />
        <ComplianceDateInput
          value={dateTo}
          onChange={(v) => {
            setDateTo(v);
            setPage(0);
          }}
          title="Requested on or before (IST)"
        />
        {filtersActive && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-body text-blue cursor-pointer border-none bg-transparent p-0"
          >
            Clear all
          </button>
        )}
      </div>
      <TableShell columns={COLUMNS} scrollLabel="Recorded data-subject requests" state={tableState}>
        {requests.map((r) => {
          const look = DATA_REQUEST_LOOK[r.status];
          const actions = dataRequestActions(r, canEdit);
          const isOpen = actions.canPrepare || actions.canRectify || actions.canReject;
          return (
            <tr
              key={r.id}
              onClick={() => setOpenId(r.id)}
              className="hover:bg-grey-200 cursor-pointer transition-colors duration-150"
            >
              <td className={cn(tdClass, 'whitespace-nowrap')}>
                <OpsEntity
                  icon="file-down"
                  tint={r.status === 'completed' ? 'success' : isOpen ? 'warning' : 'neutral'}
                  title={r.requestNo}
                  sub={DATA_REQUEST_KIND_LABEL[r.kind]}
                />
              </td>
              <td className={cn(tdClass, 'max-w-80')} title={r.subjectUserId ?? undefined}>
                <div className="flex flex-col">
                  <span>{r.subjectName ?? DATA_SUBJECT_LABEL[r.subjectKind]}</span>
                  {r.subjectContact ? (
                    <span className="text-caption text-text-muted">{r.subjectContact}</span>
                  ) : (
                    r.subjectUserId && (
                      <span className="text-caption text-text-muted tabular-nums">
                        {r.subjectUserId.slice(0, ID_PREVIEW_CHARS)}…
                      </span>
                    )
                  )}
                </div>
              </td>
              <td className={tdClass}>
                {r.requestedByName ??
                  (r.requestedByKind === 'self' ? 'The account holder' : 'Ops staff')}
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
                  <span className="text-caption text-text-muted">{dataRequestNote(r)}</span>
                </div>
              </td>
              <td className={tdClass} onClick={(e) => e.stopPropagation()}>
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
                  {actions.canPrepare && (
                    <Button
                      size="sm"
                      busy={processingId === r.id}
                      disabled={processingId != null && processingId !== r.id}
                      onClick={() => onProcess(r)}
                    >
                      Prepare now
                    </Button>
                  )}
                  {actions.canRectify && (
                    <Button size="sm" onClick={() => setRectifying(r)}>
                      Mark rectified
                    </Button>
                  )}
                  {actions.canReject && (
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
      <DataRequestDrawer
        requestId={openId}
        canEdit={canEdit}
        busyId={processingId}
        onClose={() => setOpenId(null)}
        onPrepare={onProcess}
        onRectify={setRectifying}
        onReject={setRejecting}
      />
      {rejecting && (
        <RejectDataRequestModal
          requestNo={rejecting.requestNo}
          busy={rejectMutation.isPending}
          onClose={() => setRejecting(null)}
          onReject={handleReject}
        />
      )}
      {rectifying && (
        <RectifyDataRequestModal
          requestNo={rectifying.requestNo}
          busy={processMutation.isPending}
          onClose={() => setRectifying(null)}
          onRectify={handleRectify}
        />
      )}
    </Card>
  );
}
