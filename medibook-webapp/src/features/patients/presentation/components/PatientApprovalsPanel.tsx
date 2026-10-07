import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { cn } from '@/shared/lib/cn';
import { fmtDate } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { InfoDot } from '@/shared/ui/InfoDot';
import { Pager } from '@/shared/ui/Pager';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SegTabs } from '@/shared/ui/SegTabs';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';

import { usePatientApprovalsQuery } from '@/features/patients/application/queries/usePatientApprovalsQuery';
import type {
  PatientApproval,
  PatientApprovalListParams,
  PatientChangeKind,
  PatientChangeStatus,
} from '@/features/patients/domain/entities/patients.entities';
import { PatientChangeValues } from '@/features/patients/presentation/components/PatientChangeValues';
import { PatientDecisionActions } from '@/features/patients/presentation/components/PatientDecisionActions';
import {
  APPROVAL_STATUS_BADGES,
  formatTime,
} from '@/features/patients/presentation/components/patientsFormat';

const PAGE_SIZE = 10;

const STATUS_TABS = ['Pending', 'Approved', 'Rejected', 'All'] as const;
type StatusTab = (typeof STATUS_TABS)[number];

const TAB_STATUSES: Readonly<Record<StatusTab, readonly PatientChangeStatus[]>> = {
  Pending: ['pending'],
  Approved: ['approved'],
  Rejected: ['rejected'],
  All: [],
};

const ANY_KIND = 'Edits and deletions';
const KIND_OPTIONS: Readonly<Record<string, PatientChangeKind>> = {
  Edits: 'edit',
  Deletions: 'delete',
};

const COLUMNS = ['Patient', 'Requested change', 'Requested', 'Decision'] as const;

interface PatientApprovalsPanelProps {
  /** Open a record from the queue. */
  onOpenPatient: (mrn: string) => void;
}

function RequestCell({ row }: { row: PatientApproval }) {
  if (row.kind === 'delete') {
    return <span className="text-d-700 font-medium">Delete this record</span>;
  }
  if (row.changes.length === 0) return <span className="text-text-muted">Edit</span>;
  return <PatientChangeValues changes={row.changes} />;
}

function DecisionCell({ row }: { row: PatientApproval }) {
  if (row.status === 'pending') {
    return (
      <PatientDecisionActions
        size="sm"
        requestId={row.id}
        kind={row.kind}
        requestedByUserId={row.requestedByUserId}
      />
    );
  }
  const badge = APPROVAL_STATUS_BADGES[row.status];
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge status={badge.status}>{badge.label}</Badge>
      <span className="text-caption text-text-muted">
        {row.reviewedByName ?? 'An administrator'}
        {row.reviewedAt ? ` · ${fmtDate(row.reviewedAt.slice(0, 10))}` : ''}
      </span>
      {row.reviewNote && <span className="text-caption text-text-body">“{row.reviewNote}”</span>}
    </div>
  );
}

/**
 * The patient approvals queue (D-29, UAT-21): every edit and deletion the
 * desk asked for, with the current and proposed value of each field, who
 * asked and when, and Approve / Reject for the administrators who may decide.
 * Decided requests stay listed with the reviewer and note.
 */
export function PatientApprovalsPanel({ onOpenPatient }: PatientApprovalsPanelProps) {
  const [tab, setTab] = useState<StatusTab>('Pending');
  const [kindLabel, setKindLabel] = useState(ANY_KIND);
  const [page, setPage] = useState(0);

  const params: PatientApprovalListParams = {
    page: page + 1,
    pageSize: PAGE_SIZE,
    statuses: TAB_STATUSES[tab],
    kind: KIND_OPTIONS[kindLabel] ?? null,
  };
  const query = usePatientApprovalsQuery(params, true);
  const rows = query.data?.items ?? [];

  const state: TableStateSpec | undefined = query.isPending
    ? { kind: 'loading', rows: 4 }
    : query.isError
      ? {
          kind: 'error',
          title: 'The approvals queue didn’t load',
          message: isFailure(query.error) ? query.error.message : undefined,
          onRetry: () => void query.refetch(),
        }
      : rows.length === 0
        ? {
            kind: 'empty',
            icon: 'circle-check',
            title: tab === 'Pending' ? 'Nothing waiting for approval.' : 'No requests here.',
            message:
              tab === 'Pending'
                ? 'Edits and deletions the desk asks for appear here for an administrator to approve.'
                : 'Change the filters to see other requests.',
          }
        : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <SegTabs
          tabs={STATUS_TABS}
          value={tab}
          onChange={(t) => {
            setTab(STATUS_TABS.find((s) => s === t) ?? 'Pending');
            setPage(0);
          }}
        />
        <FilterSelect
          value={kindLabel}
          options={[ANY_KIND, ...Object.keys(KIND_OPTIONS)]}
          onChange={(v) => {
            setKindLabel(v);
            setPage(0);
          }}
          aria-label="Filter requests by kind"
        />
        <RefreshBtn
          onRefresh={async () => {
            await query.refetch();
          }}
          title="Refresh the approvals queue"
        />
        <InfoDot text="When the hospital requires approval for patient edits, every change the desk makes waits here. Approving applies exactly the fields listed; rejecting leaves the record as it is. Nobody can approve their own request." />
      </div>
      <TableShell columns={COLUMNS} state={state} scrollLabel="Patient approvals">
        {rows.map((row) => (
          <tr key={row.id}>
            <td className={cn(tdClass, 'align-top')}>
              {row.patient.isDeleted ? (
                <span className="text-text-strong font-medium">{row.patient.fullName}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenPatient(row.patient.mrn)}
                  className="text-blue cursor-pointer border-none bg-transparent p-0 text-left font-medium"
                >
                  {row.patient.fullName}
                </button>
              )}
              <div className="text-caption text-text-muted">
                {row.patient.mrn}
                {row.patient.isDeleted ? ' · deleted' : ''}
              </div>
            </td>
            <td className={cn(tdClass, 'max-w-110 align-top')}>
              <RequestCell row={row} />
            </td>
            <td className={cn(tdClass, 'align-top whitespace-nowrap')}>
              {row.requestedByName ?? 'Staff'}
              <div className="text-caption text-text-muted">
                {fmtDate(row.requestedAt.slice(0, 10))} · {formatTime(row.requestedAt)}
              </div>
            </td>
            <td className={cn(tdClass, 'align-top')}>
              <DecisionCell row={row} />
            </td>
          </tr>
        ))}
      </TableShell>
      <Pager
        total={query.data?.total ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        onPage={setPage}
        noun="requests"
      />
    </div>
  );
}
