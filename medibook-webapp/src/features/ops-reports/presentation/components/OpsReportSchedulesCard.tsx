import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { IconBtn } from '@/shared/ui/IconBtn';
import { Pager } from '@/shared/ui/Pager';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { toast } from '@/shared/ui/toast/toast.store';

import { useHospitalOptionsQuery } from '@/features/ops-hospitals/application/queries/useHospitalOptionsQuery';
import { useReportSchedulesQuery } from '@/features/ops-reports/application/queries/useReportSchedulesQuery';
import { useSaveReportScheduleMutation } from '@/features/ops-reports/application/queries/useSaveReportScheduleMutation';
import type {
  OpsReportSummary,
  ReportSchedule,
  ReportScheduleScope,
} from '@/features/ops-reports/domain/entities/opsReports.types';
import { RUN_STATUS_LOOK } from '@/features/ops-reports/presentation/components/opsReportsFormat';
import { ReportScheduleModal } from '@/features/ops-reports/presentation/components/ReportScheduleModal';

const PAGE_SIZE = 10;
const COLUMNS = ['Report', 'Sent to', 'When', 'Last run', 'Status', ''] as const;

const SCOPE_OPTIONS: readonly {
  readonly label: string;
  readonly scope: ReportScheduleScope | null;
}[] = [
  { label: 'All schedules', scope: null },
  { label: 'Platform reports', scope: 'platform' },
  { label: 'Hospital reports', scope: 'hospital' },
];

const WHEN_FORMAT = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

type EditorState = { readonly kind: 'new' } | { readonly kind: 'edit'; readonly id: string } | null;

interface OpsReportSchedulesCardProps {
  reports: readonly OpsReportSummary[];
}

function recipientsLine(s: ReportSchedule): string {
  if (s.usesDefaultRecipients || s.recipients.length === 0) return 'The hospital’s admins';
  const [first, ...rest] = s.recipients;
  return rest.length > 0 ? `${first} +${rest.length} more` : (first ?? '');
}

/**
 * Scheduled report emails (Q144, UAT-36 / 12·R7) — platform and hospital
 * schedules with their last run (B7), created and edited here, paused and
 * resumed in place. `DELETE` on the backend only switches a schedule off, so
 * Pause is the one off-switch offered.
 */
export function OpsReportSchedulesCard({ reports }: OpsReportSchedulesCardProps) {
  const [page, setPage] = useState(0);
  const [scope, setScope] = useState<ReportScheduleScope | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const schedules = useReportSchedulesQuery({
    page: page + 1,
    pageSize: PAGE_SIZE,
    scope,
    activeOnly: false,
  });
  const toggle = useSaveReportScheduleMutation();
  const hospitals = useHospitalOptionsQuery();
  const rows = schedules.data?.items ?? [];
  const editing = editor?.kind === 'edit' ? (rows.find((s) => s.id === editor.id) ?? null) : null;

  const handleToggle = (s: ReportSchedule): void => {
    toggle.mutate(
      { kind: 'update', id: s.id, changes: { isActive: !s.isActive }, version: s.version },
      {
        onSuccess: () => toast(s.isActive ? 'Schedule paused.' : 'Schedule resumed.', 'success'),
        onError: (error) =>
          toast(isFailure(error) ? error.message : 'Could not change the schedule.', 'error'),
      },
    );
  };

  const tableState: TableStateSpec | undefined = schedules.isPending
    ? { kind: 'loading', rows: 4 }
    : schedules.isError
      ? {
          kind: 'error',
          title: "Scheduled reports didn't load",
          message: isFailure(schedules.error) ? schedules.error.message : undefined,
          onRetry: () => void schedules.refetch(),
        }
      : rows.length === 0
        ? {
            kind: 'empty',
            icon: 'calendar-clock',
            title: 'No scheduled reports yet.',
            message: 'Schedule a report to email it to the team every day or every week.',
          }
        : undefined;

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SectionTitle>Scheduled emails</SectionTitle>
        <div className="flex-1"></div>
        <FilterSelect
          value={SCOPE_OPTIONS.find((o) => o.scope === scope)?.label ?? ''}
          options={SCOPE_OPTIONS.map((o) => o.label)}
          onChange={(v) => {
            setScope(SCOPE_OPTIONS.find((o) => o.label === v)?.scope ?? null);
            setPage(0);
          }}
          aria-label="Filter schedules by scope"
        />
        <Button
          icon="plus"
          disabled={reports.length === 0}
          onClick={() => setEditor({ kind: 'new' })}
        >
          Schedule a report
        </Button>
      </div>
      <TableShell columns={COLUMNS} scrollLabel="Scheduled report emails" state={tableState}>
        {rows.map((s) => {
          const hospital =
            s.hospitalId === null
              ? null
              : (hospitals.options.find((h) => h.id === s.hospitalId)?.name ?? 'Hospital');
          const last = s.lastStatus ? RUN_STATUS_LOOK[s.lastStatus] : null;
          return (
            <tr key={s.id}>
              <td className={tdClass}>
                <div className="flex flex-col">
                  <span className="text-text-strong font-medium">
                    {s.reportTitle ?? s.reportCode}
                  </span>
                  <span className="text-caption text-text-muted">
                    {hospital ? `${hospital} · hospital report` : 'Platform report'} ·{' '}
                    {s.format.toUpperCase()}
                  </span>
                </div>
              </td>
              <td className={tdClass} title={s.recipients.join(', ')}>
                {recipientsLine(s)}
              </td>
              <td className={tdClass}>{s.cadence === 'daily' ? 'Daily' : 'Weekly'}</td>
              <td className={tdClass}>
                <div className="flex flex-col items-start gap-1">
                  {last ? <Badge status={last.badge}>{last.label}</Badge> : <span>—</span>}
                  {(s.lastRunAt ?? s.lastSentAt) && (
                    <span className="text-caption text-text-muted">
                      {WHEN_FORMAT.format(new Date(s.lastRunAt ?? s.lastSentAt ?? ''))}
                      {s.lastError ? ` · ${s.lastError}` : ''}
                    </span>
                  )}
                </div>
              </td>
              <td className={tdClass}>
                <Badge status={s.isActive ? 'Active' : 'Paused'} />
              </td>
              <td className={tdClass}>
                <div className="flex gap-2">
                  <IconBtn
                    name="pencil"
                    box={36}
                    size={15}
                    label="Edit schedule"
                    onClick={() => setEditor({ kind: 'edit', id: s.id })}
                  />
                  <IconBtn
                    name={s.isActive ? 'pause' : 'play'}
                    box={36}
                    size={15}
                    label={s.isActive ? 'Pause schedule' : 'Resume schedule'}
                    busy={
                      toggle.isPending &&
                      toggle.variables.kind === 'update' &&
                      toggle.variables.id === s.id
                    }
                    disabled={toggle.isPending}
                    onClick={() => handleToggle(s)}
                  />
                </div>
              </td>
            </tr>
          );
        })}
      </TableShell>
      <Pager
        total={schedules.data?.total ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        onPage={setPage}
        noun="schedules"
      />
      {editor && (
        <ReportScheduleModal
          key={editor.kind === 'edit' ? editor.id : 'new'}
          schedule={editing}
          reports={reports}
          onClose={() => setEditor(null)}
        />
      )}
    </Card>
  );
}
