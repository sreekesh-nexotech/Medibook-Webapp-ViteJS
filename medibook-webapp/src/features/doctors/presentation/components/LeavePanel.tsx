import { useState } from 'react';

import type { DoctorLeaveEntry, LeaveKind } from '@/features/doctors/domain/entities/doctors.types';
import {
  useDeleteLeaveMutation,
  useSaveLeaveMutation,
} from '@/features/doctors/application/queries/useScheduleMutations';
import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { useHospitalToday } from '@/shared/hooks/useHospitalTime';
import { describeFailure } from '@/shared/lib/serverErrors';
import { fmtDate } from '@/shared/lib/format';
import { dateRange, required } from '@/shared/lib/validate';
import { Button } from '@/shared/ui/Button';
import { Can } from '@/shared/ui/Can';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Field } from '@/shared/ui/Field';
import { FormErrorSummary } from '@/shared/ui/FormErrorSummary';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { IconBtn } from '@/shared/ui/IconBtn';
import { InfoDot } from '@/shared/ui/InfoDot';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import { LEAVE_KIND_LABEL } from './doctors.view';
import { ScheduleChangeModal } from './ScheduleChangeModal';
import { useScheduleConfirm } from './useScheduleConfirm';

/** Leave types the backend accepts, in display order. */
const LEAVE_KINDS: readonly LeaveKind[] = ['casual', 'sick', 'conference', 'other'];

const LEAVE_OPTIONS = LEAVE_KINDS.map((k) => LEAVE_KIND_LABEL[k]);

function kindFromLabel(label: string): LeaveKind {
  return LEAVE_KINDS.find((k) => LEAVE_KIND_LABEL[k] === label) ?? 'casual';
}

function failureText(error: unknown, fallback: string): string {
  return describeFailure(error, fallback);
}

/** Server field → leave form field (UAT-48). */
const LEAVE_SERVER_FIELDS = {
  date_from: 'from',
  date_to: 'to',
  leave_type: 'kind',
  reason: 'reason',
} as const;

function rangeLabel(from: string, to: string): string {
  return from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`;
}

interface LeaveForm {
  from: string;
  to: string;
  kind: LeaveKind;
  reason: string;
}

const LEAVE_VALIDATORS: FormValidators<LeaveForm> = {
  from: (v) => required(v, 'Start date'),
  to: (v, values) => dateRange(values.from, v),
  reason: (v) => required(v, 'Reason'),
};

interface LeaveModalProps {
  doctorId: string;
  leave: DoctorLeaveEntry | null;
  onClose: () => void;
}

/**
 * Add / edit one leave entry. Saving is a dry run first: if bookings fall in
 * the range, the user is asked before they are cancelled (and refunded).
 */
function LeaveModal({ doctorId, leave, onClose }: LeaveModalProps) {
  const save = useSaveLeaveMutation();
  const confirm = useScheduleConfirm();
  // A new leave starts on the hospital's today, not the PC's (D-09, UAT-47).
  const { today } = useHospitalToday();
  const form = useForm<LeaveForm>({
    initial: {
      from: leave?.dateFrom ?? today,
      to: leave?.dateTo ?? today,
      kind: leave?.kind ?? 'casual',
      reason: leave?.reason ?? '',
    },
    validate: LEAVE_VALIDATORS,
    onSubmit: (values) =>
      confirm.run({
        attempt: (mode) =>
          save.mutateAsync({
            doctorId,
            mode,
            existing: leave ? { id: leave.id, version: leave.version } : undefined,
            input: {
              kind: values.kind,
              dateFrom: values.from,
              dateTo: values.to,
              reason: values.reason.trim(),
            },
          }),
        onApplied: () => {
          toast(leave ? 'Leave updated' : 'Leave added', 'success');
          onClose();
        },
        onError: (error) =>
          toast(
            form.applyServerErrors(
              error,
              { fields: LEAVE_SERVER_FIELDS },
              'Could not save the leave.',
            ),
            'error',
          ),
      }),
  });
  return (
    <>
      <FormModal
        open
        onClose={onClose}
        title={leave ? 'Edit Leave' : 'Add Leave'}
        width={560}
        onSubmit={form.handleSubmit}
        submitLabel={leave ? 'Save Leave' : 'Add Leave'}
        busy={form.submitting || confirm.modal.isApplying}
      >
        <div className="flex flex-col gap-4.5">
          <FormErrorSummary messages={form.serverSummary} />
          <div className="grid grid-cols-2 gap-4.5">
            <Field label="From" required error={form.errorFor('from')}>
              <TextInput
                value={form.values.from}
                type="date"
                onChange={(v) => form.setField('from', v)}
                onBlur={() => form.blurField('from')}
              />
            </Field>
            <Field label="To" required error={form.errorFor('to')}>
              <TextInput
                value={form.values.to}
                type="date"
                onChange={(v) => form.setField('to', v)}
                onBlur={() => form.blurField('to')}
              />
            </Field>
          </div>
          <Field label="Leave Type" required>
            <Select
              value={LEAVE_KIND_LABEL[form.values.kind]}
              options={LEAVE_OPTIONS}
              onChange={(v) => form.setField('kind', kindFromLabel(v))}
            />
          </Field>
          <Field
            label="Reason"
            required
            error={form.errorFor('reason')}
            hint="Shown to the front desk, never to patients."
          >
            <TextInput
              value={form.values.reason}
              placeholder="e.g. Cardiology Society annual meet"
              onChange={(v) => form.setField('reason', v)}
              onBlur={() => form.blurField('reason')}
            />
          </Field>
        </div>
      </FormModal>
      <ScheduleChangeModal {...confirm.modal} />
    </>
  );
}

interface LeavePanelProps {
  doctorId: string;
  leave: readonly DoctorLeaveEntry[];
}

/**
 * Leave / unavailability for one doctor, saved to the backend. Adding,
 * editing or removing leave is a dry run first; bookings it would cancel are
 * named before anything is applied.
 */
export function LeavePanel({ doctorId, leave }: LeavePanelProps) {
  const remove = useDeleteLeaveMutation();
  const confirm = useScheduleConfirm();
  const [editing, setEditing] = useState<{ leave: DoctorLeaveEntry | null } | null>(null);
  const [removing, setRemoving] = useState<DoctorLeaveEntry | null>(null);

  const confirmRemove = (): void => {
    if (!removing) return;
    const target = removing;
    setRemoving(null);
    void confirm.run({
      attempt: (mode) =>
        remove.mutateAsync({
          doctorId,
          leave: { id: target.id, version: target.version },
          mode,
        }),
      onApplied: () => toast('Leave removed', 'info'),
      onError: (error) => toast(failureText(error, 'Could not remove the leave.'), 'error'),
    });
  };

  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className="text-body text-text-strong font-medium">Leave / Unavailability</span>
        <InfoDot text="Block dates the doctor is unavailable. Booking is disabled in the app for these dates and the slot grid shows no slots." />
        <span className="flex-1" />
        <Can perm={'Doctors & Departments.add'}>
          <Button
            size="sm"
            variant="secondary"
            icon="plus"
            onClick={() => setEditing({ leave: null })}
          >
            Add Leave
          </Button>
        </Can>
      </div>
      {leave.length === 0 ? (
        <EmptyState
          compact
          icon="plane"
          title="No upcoming leave"
          message="Add a date range and the app stops offering slots for it."
          actionLabel="Add Leave"
          actionIcon="plus"
          onAction={() => setEditing({ leave: null })}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {leave.map((l) => (
            <div
              key={l.id}
              className="border-border-soft flex flex-wrap items-center gap-3 rounded-md border px-3.5 py-3"
            >
              <div className="bg-y-100 text-y-700 flex size-8.5 flex-none items-center justify-center rounded-md">
                <Icon name="plane" size={17} />
              </div>
              <div className="min-w-40 flex-1">
                <div className="text-body text-text-strong font-medium">
                  {rangeLabel(l.dateFrom, l.dateTo)}
                </div>
                <div className="text-caption text-text-muted">
                  {LEAVE_KIND_LABEL[l.kind]} leave{l.reason ? ` · ${l.reason}` : ''}
                </div>
              </div>
              <Can perm={'Doctors & Departments.edit'}>
                <IconBtn
                  name="pencil"
                  label="Edit leave"
                  box={32}
                  size={15}
                  onClick={() => setEditing({ leave: l })}
                />
              </Can>
              <Can perm={'Doctors & Departments.del'}>
                <IconBtn
                  name="trash-2"
                  label="Remove leave"
                  box={32}
                  size={15}
                  color="var(--color-d-500)"
                  onClick={() => setRemoving(l)}
                />
              </Can>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <LeaveModal
          key={editing.leave?.id ?? 'new-leave'}
          doctorId={doctorId}
          leave={editing.leave}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmModal
        open={Boolean(removing)}
        danger
        confirmLabel="Remove"
        title="Remove Leave"
        body={
          removing
            ? `Remove the ${LEAVE_KIND_LABEL[removing.kind].toLowerCase()} leave on ${rangeLabel(
                removing.dateFrom,
                removing.dateTo,
              )}? Those dates become bookable again.`
            : ''
        }
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
      <ScheduleChangeModal {...confirm.modal} />
    </div>
  );
}
