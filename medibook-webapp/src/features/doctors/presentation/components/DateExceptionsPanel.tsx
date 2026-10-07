import { useState } from 'react';

import { timeLabelToMinutes, todayIso } from '@/features/doctors/domain/calendar';
import type { DoctorDateException } from '@/features/doctors/domain/entities/doctors.types';
import {
  useDeleteDateExceptionMutation,
  useSaveDateExceptionMutation,
} from '@/features/doctors/application/queries/useScheduleMutations';
import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { fmtDate } from '@/shared/lib/format';
import { required } from '@/shared/lib/validate';
import { Button } from '@/shared/ui/Button';
import { Can } from '@/shared/ui/Can';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { IconBtn } from '@/shared/ui/IconBtn';
import { InfoDot } from '@/shared/ui/InfoDot';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { Toggle } from '@/shared/ui/Toggle';
import { toast } from '@/shared/ui/toast/toast.store';

import { isFailure } from '@/core/error/failure';

import { hhmmToLabel, labelToHhmm, timeOptionsWith } from './doctors.view';
import { ScheduleChangeModal } from './ScheduleChangeModal';
import { useScheduleConfirm } from './useScheduleConfirm';

/** Session written for a "different hours" exception (one window, Q32). */
const EXCEPTION_SESSION_CODE = 'custom-1';
const EXCEPTION_SESSION_LABEL = 'Special hours';

function failureText(error: unknown, fallback: string): string {
  return isFailure(error) ? error.message : fallback;
}

/** "10:00 am – 1:00 pm, 4:00 pm – 7:00 pm" for an exception's windows. */
function windowsLabel(exception: DoctorDateException): string {
  return exception.sessions
    .map((w) => `${hhmmToLabel(w.startsAt)} – ${hhmmToLabel(w.endsAt)}`)
    .join(', ');
}

/** What an exception does to one date — the two cases the audit asks for. */
const EXCEPTION_KINDS = ['Different hours', 'Closed all day'] as const;

type ExceptionKind = (typeof EXCEPTION_KINDS)[number];

interface ExceptionForm {
  date: string;
  kind: ExceptionKind;
  from: string;
  to: string;
  note: string;
}

const EXCEPTION_VALIDATORS: FormValidators<ExceptionForm> = {
  date: (v) => required(v, 'Date'),
  to: (v, values) => {
    if (values.kind === 'Closed all day') return undefined;
    const from = timeLabelToMinutes(values.from);
    const to = timeLabelToMinutes(v);
    if (from == null || to == null) return 'Pick a start and an end time.';
    return to > from ? undefined : 'The end time must be after the start time.';
  },
  note: (v) => required(v, 'Reason'),
};

interface ExceptionModalProps {
  doctorId: string;
  exception: DoctorDateException | null;
  onClose: () => void;
}

/**
 * Add / edit one per-date override of the weekly pattern. Saving is a dry run
 * first; bookings the new hours would cancel are named before applying.
 */
function ExceptionModal({ doctorId, exception, onClose }: ExceptionModalProps) {
  const save = useSaveDateExceptionMutation();
  const confirm = useScheduleConfirm();
  const firstWindow = exception?.sessions[0];
  const form = useForm<ExceptionForm>({
    initial: {
      date: exception?.date ?? todayIso(),
      kind: exception?.kind === 'closed' ? 'Closed all day' : 'Different hours',
      from: firstWindow ? hhmmToLabel(firstWindow.startsAt) : '10:00 am',
      to: firstWindow ? hhmmToLabel(firstWindow.endsAt) : '1:00 pm',
      note: exception?.note ?? '',
    },
    validate: EXCEPTION_VALIDATORS,
    onSubmit: (values) => {
      const closed = values.kind === 'Closed all day';
      const startsAt = labelToHhmm(values.from) ?? '';
      const endsAt = labelToHhmm(values.to) ?? '';
      return confirm.run({
        attempt: (isConfirmed) =>
          save.mutateAsync({
            doctorId,
            confirm: isConfirmed,
            existing: exception ? { id: exception.id, version: exception.version } : undefined,
            input: {
              date: values.date,
              kind: closed ? 'closed' : 'custom_sessions',
              note: values.note.trim(),
              sessions: closed
                ? []
                : [
                    {
                      sessionCode: EXCEPTION_SESSION_CODE,
                      label: EXCEPTION_SESSION_LABEL,
                      startsAt,
                      endsAt,
                    },
                  ],
            },
          }),
        onApplied: () => {
          toast(exception ? 'Date exception updated' : 'Date exception added', 'success');
          onClose();
        },
        onError: (error) =>
          toast(failureText(error, 'Could not save the date exception.'), 'error', error),
      });
    },
  });
  const isClosed = form.values.kind === 'Closed all day';
  const hasExtraWindows = (exception?.sessions.length ?? 0) > 1;
  return (
    <>
      <FormModal
        dirty={form.isDirty}
        open
        onClose={onClose}
        title={exception ? 'Edit Date Exception' : 'Add Date Exception'}
        width={560}
        onSubmit={form.handleSubmit}
        submitLabel={exception ? 'Save Exception' : 'Add Exception'}
        busy={form.submitting || confirm.modal.isApplying}
      >
        <div className="flex flex-col gap-4.5">
          <Field
            label="Date"
            required
            error={form.errorFor('date')}
            hint="This one date only — the weekly pattern is untouched."
          >
            <TextInput
              value={form.values.date}
              type="date"
              onChange={(v) => form.setField('date', v)}
              onBlur={() => form.blurField('date')}
            />
          </Field>
          <div className="border-border-soft flex items-center justify-between rounded-md border px-3.5 py-3">
            <span className="text-body text-text-body" id="exception-closed-label">
              Closed all day
            </span>
            <Toggle
              value={isClosed}
              onChange={(v) => form.setField('kind', v ? 'Closed all day' : 'Different hours')}
              aria-labelledby="exception-closed-label"
            />
          </div>
          {!isClosed && (
            <div className="grid grid-cols-2 gap-4.5">
              <Field label="Opens" required>
                <Select
                  value={form.values.from}
                  options={timeOptionsWith(form.values.from)}
                  onChange={(v) => form.setField('from', v)}
                />
              </Field>
              <Field label="Closes" required error={form.errorFor('to')}>
                <Select
                  value={form.values.to}
                  options={timeOptionsWith(form.values.to)}
                  onChange={(v) => form.setField('to', v)}
                  onBlur={() => form.blurField('to')}
                />
              </Field>
            </div>
          )}
          {!isClosed && hasExtraWindows && (
            <p className="text-caption text-text-muted">
              This date has {exception?.sessions.length} windows; saving keeps only the one above.
            </p>
          )}
          <Field label="Reason" required error={form.errorFor('note')}>
            <TextInput
              value={form.values.note}
              placeholder="e.g. Extra weekend clinic"
              onChange={(v) => form.setField('note', v)}
              onBlur={() => form.blurField('note')}
            />
          </Field>
        </div>
      </FormModal>
      <ScheduleChangeModal {...confirm.modal} />
    </>
  );
}

interface DateExceptionsPanelProps {
  doctorId: string;
  exceptions: readonly DoctorDateException[];
}

/**
 * Per-date exceptions for one doctor (audit 2.4 / HA-07: "per-date exceptions
 * have no working control"). An exception overrides one calendar date —
 * an extra clinic on a normally closed day, or an early close — without
 * touching the weekly pattern, and the slot grid generates that date's slots
 * from it.
 */
export function DateExceptionsPanel({ doctorId, exceptions }: DateExceptionsPanelProps) {
  const remove = useDeleteDateExceptionMutation();
  const confirm = useScheduleConfirm();
  const [editing, setEditing] = useState<{ exception: DoctorDateException | null } | null>(null);
  const [removing, setRemoving] = useState<DoctorDateException | null>(null);

  const confirmRemove = (): void => {
    if (!removing) return;
    const target = removing;
    setRemoving(null);
    void confirm.run({
      attempt: (isConfirmed) =>
        remove.mutateAsync({
          doctorId,
          exceptionId: target.id,
          version: target.version,
          confirm: isConfirmed,
        }),
      onApplied: () => toast('Date exception removed', 'info'),
      onError: (error) =>
        toast(failureText(error, 'Could not remove the date exception.'), 'error', error),
    });
  };

  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className="text-body text-text-strong font-medium">Date Exceptions</span>
        <InfoDot text="Override one date's hours — an extra clinic, or an early close — without changing the weekly pattern." />
        <span className="flex-1" />
        <Can perm={'Doctors & Departments.add'}>
          <Button
            size="sm"
            variant="ghost"
            icon="calendar-plus"
            onClick={() => setEditing({ exception: null })}
          >
            Add Date Exception
          </Button>
        </Can>
      </div>
      {exceptions.length === 0 ? (
        <EmptyState
          compact
          icon="calendar-days"
          title="No date exceptions"
          message="The weekly pattern applies to every date. Add an exception for a one-off change."
          actionLabel="Add Date Exception"
          actionIcon="calendar-plus"
          onAction={() => setEditing({ exception: null })}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {exceptions.map((e) => (
            <div
              key={e.id}
              className="border-border-soft flex flex-wrap items-center gap-3 rounded-md border px-3.5 py-3"
            >
              <div
                className={
                  e.kind === 'closed'
                    ? 'bg-d-100 text-d-600 flex size-8.5 flex-none items-center justify-center rounded-md'
                    : 'bg-g-100 text-g-800 flex size-8.5 flex-none items-center justify-center rounded-md'
                }
              >
                <Icon name={e.kind === 'closed' ? 'calendar-x' : 'calendar-check'} size={17} />
              </div>
              <div className="min-w-40 flex-1">
                <div className="text-body text-text-strong font-medium">{fmtDate(e.date)}</div>
                <div className="text-caption text-text-muted">
                  {e.kind === 'closed' ? 'Closed all day' : windowsLabel(e)}
                  {e.note ? ` · ${e.note}` : ''}
                </div>
              </div>
              <Can perm={'Doctors & Departments.edit'}>
                <IconBtn
                  name="pencil"
                  label="Edit date exception"
                  box={32}
                  size={15}
                  onClick={() => setEditing({ exception: e })}
                />
              </Can>
              <Can perm={'Doctors & Departments.del'}>
                <IconBtn
                  name="trash-2"
                  label="Remove date exception"
                  box={32}
                  size={15}
                  color="var(--color-d-600)"
                  onClick={() => setRemoving(e)}
                />
              </Can>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ExceptionModal
          key={editing.exception?.id ?? 'new-exception'}
          doctorId={doctorId}
          exception={editing.exception}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmModal
        open={Boolean(removing)}
        danger
        confirmLabel="Remove"
        title="Remove Date Exception"
        body={
          removing
            ? `Remove the exception on ${fmtDate(removing.date)}? That date goes back to the weekly pattern.`
            : ''
        }
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
      <ScheduleChangeModal {...confirm.modal} />
    </div>
  );
}
