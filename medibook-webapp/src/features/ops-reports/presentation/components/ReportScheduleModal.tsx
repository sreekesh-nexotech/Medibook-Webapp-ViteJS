import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { FormModal } from '@/shared/ui/FormModal';
import { OpsField } from '@/shared/ui/OpsField';
import { Select } from '@/shared/ui/Select';
import { TextArea } from '@/shared/ui/TextArea';
import { Toggle } from '@/shared/ui/Toggle';
import { toast } from '@/shared/ui/toast/toast.store';

import { useSaveReportScheduleMutation } from '@/features/ops-reports/application/queries/useSaveReportScheduleMutation';
import type {
  OpsReportFormat,
  OpsReportSummary,
  ReportSchedule,
  ReportScheduleCadence,
  ReportScheduleChanges,
} from '@/features/ops-reports/domain/entities/opsReports.types';
import {
  MAX_RECIPIENTS,
  parseRecipients,
} from '@/features/ops-reports/presentation/components/opsReportsFormat';
import { useOpsStaffQuery } from '@/features/ops-users/application/queries/useOpsStaffQuery';

const CADENCE_LABEL: Readonly<Record<ReportScheduleCadence, string>> = {
  daily: 'Daily — yesterday’s figures, every morning',
  weekly: 'Weekly — the previous 7 days, every Monday',
};
const CADENCES: readonly ReportScheduleCadence[] = ['daily', 'weekly'];

const FORMAT_LABEL: Readonly<Record<OpsReportFormat, string>> = {
  xlsx: 'Excel (.xlsx)',
  csv: 'CSV',
  pdf: 'PDF',
};
const FORMATS: readonly OpsReportFormat[] = ['xlsx', 'csv', 'pdf'];

interface ScheduleErrors {
  report?: string | null;
  recipients?: string | null;
}

interface ReportScheduleModalProps {
  /** The schedule being edited, or `null` for a new platform schedule. */
  schedule: ReportSchedule | null;
  /** The platform catalogue (a new schedule picks from it). */
  reports: readonly OpsReportSummary[];
  onClose: () => void;
}

/**
 * Create or edit an emailed report (`/platform/report-schedules`, Q144).
 * Recipients must be active staff emails — the backend checks — and a new
 * schedule is platform-scope. Edits carry the version as `If-Match` (B7).
 * Mount it only while open.
 */
export function ReportScheduleModal({ schedule, reports, onClose }: ReportScheduleModalProps) {
  const save = useSaveReportScheduleMutation();
  const staff = useOpsStaffQuery();
  const editing = schedule !== null;
  const platformScope = !editing || schedule.scope === 'platform';
  const [reportCode, setReportCode] = useState(schedule?.reportCode ?? reports[0]?.code ?? '');
  const [cadence, setCadence] = useState<ReportScheduleCadence>(schedule?.cadence ?? 'daily');
  const [format, setFormat] = useState<OpsReportFormat>(schedule?.format ?? 'xlsx');
  const [recipients, setRecipients] = useState((schedule?.recipients ?? []).join(', '));
  const [isActive, setIsActive] = useState(schedule?.isActive ?? true);
  const [err, setErr] = useState<ScheduleErrors>({});

  const activeStaffEmails = (staff.data?.items ?? [])
    .filter((m) => m.status === 'active' && m.email)
    .map((m) => m.email.toLowerCase());
  const parsed = parseRecipients(recipients);
  const chosen = 'emails' in parsed ? parsed.emails : [];
  const suggestions = activeStaffEmails.filter((e) => !chosen.includes(e));

  const fail = (failure: unknown): void => {
    if (!isFailure(failure)) {
      toast('Could not save the schedule.', 'error');
      return;
    }
    setErr({
      report: failure.fieldErrors.report_code?.[0] ?? null,
      recipients: failure.fieldErrors.recipients?.[0] ?? null,
    });
    toast(failure.message, 'error');
  };

  const submit = (): void => {
    const p = parseRecipients(recipients);
    const allowEmpty = !platformScope; // hospital default = its active admins (B7)
    const e: ScheduleErrors = {
      report: reportCode ? null : 'Pick a report.',
      recipients:
        'invalid' in p
          ? `${p.invalid} is not an email address.`
          : p.emails.length === 0 && !allowEmpty
            ? 'Add at least one staff email.'
            : p.emails.length > MAX_RECIPIENTS
              ? `At most ${MAX_RECIPIENTS} recipients.`
              : null,
    };
    setErr(e);
    if (e.report || e.recipients || 'invalid' in p) return;
    if (schedule) {
      const changes: ReportScheduleChanges = {
        ...(reportCode !== schedule.reportCode ? { reportCode } : {}),
        ...(cadence !== schedule.cadence ? { cadence } : {}),
        ...(format !== schedule.format ? { format } : {}),
        ...(p.emails.join(',') !== schedule.recipients.join(',') ? { recipients: p.emails } : {}),
      };
      if (Object.keys(changes).length === 0) {
        onClose();
        return;
      }
      save.mutate(
        { kind: 'update', id: schedule.id, changes, version: schedule.version },
        {
          onSuccess: () => {
            toast('Schedule updated.', 'success');
            onClose();
          },
          onError: fail,
        },
      );
      return;
    }
    save.mutate(
      { kind: 'create', draft: { reportCode, cadence, format, recipients: p.emails, isActive } },
      {
        onSuccess: () => {
          toast('Schedule created — the first email goes out at the next run.', 'success');
          onClose();
        },
        onError: fail,
      },
    );
  };

  const reportOptions = reports.map((r) => r.title);
  const pickedTitle =
    reports.find((r) => r.code === reportCode)?.title ?? schedule?.reportTitle ?? reportCode;

  return (
    <FormModal
      open
      onClose={onClose}
      title={editing ? 'Edit scheduled report' : 'Schedule a report'}
      width={600}
      onSubmit={submit}
      submitLabel={editing ? 'Save Schedule' : 'Create Schedule'}
      busy={save.isPending}
    >
      <div className="flex flex-col gap-4">
        <OpsField label="Report" required error={err.report}>
          {platformScope ? (
            <Select
              value={pickedTitle}
              options={reportOptions}
              onChange={(title) =>
                setReportCode(reports.find((r) => r.title === title)?.code ?? reportCode)
              }
              height={48}
            />
          ) : (
            <span className="text-body text-text-strong">
              {pickedTitle} · hospital report (fixed)
            </span>
          )}
        </OpsField>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <OpsField label="How often">
            <Select
              value={CADENCE_LABEL[cadence]}
              options={CADENCES.map((c) => CADENCE_LABEL[c])}
              onChange={(v) => setCadence(CADENCES.find((c) => CADENCE_LABEL[c] === v) ?? cadence)}
              height={48}
            />
          </OpsField>
          <OpsField label="File format">
            <Select
              value={FORMAT_LABEL[format]}
              options={FORMATS.map((f) => FORMAT_LABEL[f])}
              onChange={(v) => setFormat(FORMATS.find((f) => FORMAT_LABEL[f] === v) ?? format)}
              height={48}
            />
          </OpsField>
        </div>
        <OpsField
          label="Email to"
          required={platformScope}
          error={err.recipients}
          hint={
            platformScope
              ? 'Active Medibook staff emails, separated by commas. Reports are never emailed outside the team.'
              : 'Active staff of this hospital. Leave empty to send to the hospital’s admins.'
          }
        >
          <TextArea
            value={recipients}
            onChange={(v) => {
              setRecipients(v);
              setErr((p) => ({ ...p, recipients: null }));
            }}
            rows={3}
            placeholder="farah.khan@medibook.example.com, kavya.iyer@medibook.example.com"
          />
        </OpsField>
        {platformScope && suggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-caption text-text-muted">Add:</span>
            {suggestions.slice(0, 8).map((email) => (
              <button
                key={email}
                type="button"
                onClick={() => setRecipients((r) => (r.trim() ? `${r.trim()}, ${email}` : email))}
                className="text-caption text-blue border-border cursor-pointer rounded-md border bg-white px-2.5 py-1"
              >
                {email}
              </button>
            ))}
          </div>
        )}
        {!editing && (
          <div className="flex items-center gap-3">
            <Toggle value={isActive} onChange={setIsActive} label="Start sending straight away" />
            <span className="text-body text-text-strong">Start sending straight away</span>
          </div>
        )}
      </div>
    </FormModal>
  );
}
