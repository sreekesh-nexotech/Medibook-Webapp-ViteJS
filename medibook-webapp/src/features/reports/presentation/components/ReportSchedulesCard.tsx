import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Modal } from '@/shared/ui/Modal';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SkeletonCards } from '@/shared/ui/Skeleton';
import { TextInput } from '@/shared/ui/TextInput';
import { Toggle } from '@/shared/ui/Toggle';
import { toast } from '@/shared/ui/toast/toast.store';

import { useReportSchedulesQuery } from '@/features/reports/application/queries/useReportSchedulesQuery';
import { useUpdateReportScheduleMutation } from '@/features/reports/application/queries/useUpdateReportScheduleMutation';
import type { ReportSchedule } from '@/features/reports/domain/entities/reports.entities';

interface RecipientsModalProps {
  readonly schedule: ReportSchedule;
  readonly onClose: () => void;
}

function RecipientsModal({ schedule, onClose }: RecipientsModalProps) {
  const update = useUpdateReportScheduleMutation();
  const [value, setValue] = useState(schedule.recipients.join(', '));

  const save = (): void => {
    const recipients = value
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean);
    update.mutate(
      { id: schedule.id, changes: { recipients }, version: schedule.version },
      {
        onSuccess: () => {
          toast('Recipients updated', 'success');
          onClose();
        },
        onError: (error) =>
          toast(
            isFailure(error) ? error.message : 'Could not update the recipients.',
            'error',
            error,
          ),
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Recipients — ${schedule.reportTitle ?? schedule.reportCode}`}
      width={520}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button busy={update.isPending} onClick={save}>
            Save recipients
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-body text-text-body m-0">
          Active staff email addresses, separated by commas. Leave empty to email the hospital's
          active admins at send time.
        </p>
        <TextInput value={value} onChange={setValue} placeholder="admin@hospital.example" />
      </div>
    </Modal>
  );
}

/** Hospital scheduled report emails (BE-32): pause/resume and recipients. */
export function ReportSchedulesCard({ canEdit }: { readonly canEdit: boolean }) {
  const schedules = useReportSchedulesQuery();
  const update = useUpdateReportScheduleMutation();
  const [editing, setEditing] = useState<ReportSchedule | null>(null);

  const toggle = (schedule: ReportSchedule): void => {
    update.mutate(
      { id: schedule.id, changes: { isActive: !schedule.isActive }, version: schedule.version },
      {
        onSuccess: () => toast(schedule.isActive ? 'Schedule paused' : 'Schedule resumed', 'info'),
        onError: (error) =>
          toast(
            isFailure(error) ? error.message : 'Could not update the schedule.',
            'error',
            error,
          ),
      },
    );
  };

  return (
    <Card pad={20}>
      <SectionTitle size={16} className="mb-1.5">
        Scheduled reports
      </SectionTitle>
      <p className="text-caption text-text-muted m-0 mb-4">
        Medibook emails these reports to the hospital's staff on their cadence. Pause them or change
        who receives them.
      </p>
      {schedules.isPending ? (
        <SkeletonCards count={2} lines={2} />
      ) : schedules.isLoadingError ? (
        <ErrorState
          inline
          title="Scheduled reports didn't load"
          message={isFailure(schedules.error) ? schedules.error.message : undefined}
          onRetry={() => void schedules.refetch()}
        />
      ) : schedules.data.length === 0 ? (
        <EmptyState
          compact
          icon="mail"
          title="No scheduled reports yet"
          message="The platform sets up the hospital's default scheduled reports."
        />
      ) : (
        <ul className="border-border-soft divide-border-soft m-0 flex list-none flex-col divide-y rounded-md border p-0">
          {schedules.data.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-50 flex-1">
                <div className="text-body text-text-strong font-medium">
                  {s.reportTitle ?? s.reportCode}
                </div>
                <div className="text-caption text-text-muted">
                  {s.cadence} · {s.format.toUpperCase()} ·{' '}
                  {s.usesDefaultRecipients
                    ? 'hospital admins'
                    : s.recipients.join(', ') || 'no recipients'}
                </div>
                {s.lastStatus && s.lastStatus !== 'sent' && (
                  <div className="text-caption text-d-700">
                    Last run: {s.lastError ?? s.lastStatus}
                  </div>
                )}
              </div>
              <Toggle
                value={s.isActive}
                onChange={() => toggle(s)}
                disabled={!canEdit || update.isPending}
                label={`${s.isActive ? 'Pause' : 'Resume'} ${s.reportTitle ?? s.reportCode}`}
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={!canEdit}
                onClick={() => setEditing(s)}
              >
                Recipients
              </Button>
            </li>
          ))}
        </ul>
      )}
      {editing && <RecipientsModal schedule={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}
