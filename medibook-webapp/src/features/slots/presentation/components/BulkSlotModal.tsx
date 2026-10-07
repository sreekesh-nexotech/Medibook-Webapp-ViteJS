import { useMemo, useState } from 'react';
import { formatInstant } from '@/shared/lib/format';

import { TIME_OPTS } from '@/features/doctors/domain/calendar';
import {
  formatIsoDayLabel,
  isoWeekdayIndex,
  isoWeekdayLabel,
  timeLabelToMinutes,
} from '@/features/doctors/domain/calendar';
import { useApplyBulkSlotsMutation } from '@/features/slots/application/queries/useApplyBulkSlotsMutation';
import { useBulkSlotsPreviewQuery } from '@/features/slots/application/queries/useBulkSlotsPreviewQuery';
import type {
  AffectedBooking,
  BulkSlotRequest,
  BulkSlotResult,
} from '@/features/slots/domain/entities/slots.entities';
import { timeLabelToHhMm } from '@/features/slots/presentation/components/slotsGridView';
import { isFailure } from '@/core/error/failure';
import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { cn } from '@/shared/lib/cn';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { Select } from '@/shared/ui/Select';
import { toast } from '@/shared/ui/toast/toast.store';

/** What a bulk update covers. */
type BulkScope = 'all-doctors' | 'one-doctor' | 'weekday';

/** How many upcoming occurrences of the weekday to cover. */
const WEEK_OPTIONS = ['2 weeks', '4 weeks', '8 weeks'] as const;
const DEFAULT_WEEKS = '4 weeks';

type BulkAction = 'Block' | 'Open';

const ACTION_OPTIONS: readonly BulkAction[] = ['Block', 'Open'];

/** Bookings named in the confirmation before it says "and N more". */
const MAX_NAMED_BOOKINGS = 5;

const APPLY_FAILED = 'The bulk update could not be applied. Please try again.';

interface BulkForm {
  scopeLabel: string;
  doctorId: string;
  action: BulkAction;
  from: string;
  to: string;
  weeks: string;
}

const BULK_VALIDATORS: FormValidators<BulkForm> = {
  to: (v, values) => {
    const from = timeLabelToMinutes(values.from);
    const to = timeLabelToMinutes(v);
    if (from == null || to == null) return 'Pick a start and an end time.';
    return to > from ? undefined : 'The end of the range must be after its start.';
  },
};

export interface BulkSlotDoctor {
  readonly id: string;
  readonly name: string;
}

interface BulkSlotModalProps {
  /** The date the grid is showing. */
  date: string;
  /** Department filter in force on the screen, so the count matches the view. */
  departmentId: string | null;
  /** Pre-selected doctor when the modal is opened from a grid row. */
  initialDoctorId?: string | null;
  doctors: readonly BulkSlotDoctor[];
  onClose: () => void;
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

function bookingLine(b: AffectedBooking): string {
  const time = formatInstant(b.scheduledStartAt, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${b.tokenLabel ?? b.bookingRef} ${b.patientName} (${time})`;
}

function bookingsCopy(bookings: readonly AffectedBooking[]): string {
  const named = bookings.slice(0, MAX_NAMED_BOOKINGS).map(bookingLine).join('; ');
  const rest = bookings.length - MAX_NAMED_BOOKINGS;
  return rest > 0 ? `${named}; and ${rest} more` : named;
}

/**
 * Bulk open / block (audit HA-08: "no bulk update").
 *
 * Three scopes — the whole date, one doctor on that date, or that weekday for
 * one doctor over the next few weeks — narrowed by a time range. Every count
 * comes from the backend's dry run, so the hint and the confirmation state
 * exactly what will happen. A block also takes booked slots and cancels those
 * bookings with a full refund; when it would, the confirmation names them and
 * says so on the button.
 */
export function BulkSlotModal({
  date,
  departmentId,
  initialDoctorId,
  doctors,
  onClose,
}: BulkSlotModalProps) {
  const apply = useApplyBulkSlotsMutation();
  // One idempotency key per confirmation: set when the confirm dialog opens.
  const [confirmKey, setConfirmKey] = useState<string | null>(null);

  const weekday = isoWeekdayLabel(date);
  const scopeLabels = useMemo<Readonly<Record<BulkScope, string>>>(
    () => ({
      'all-doctors': 'This date — every doctor',
      'one-doctor': 'This date — one doctor',
      weekday: `Upcoming ${weekday}s — one doctor`,
    }),
    [weekday],
  );
  const scopeOf = (label: string): BulkScope =>
    (Object.keys(scopeLabels) as BulkScope[]).find((k) => scopeLabels[k] === label) ??
    'all-doctors';

  const form = useForm<BulkForm>({
    initial: {
      scopeLabel: initialDoctorId ? scopeLabels['one-doctor'] : scopeLabels['all-doctors'],
      doctorId: initialDoctorId ?? doctors[0]?.id ?? '',
      action: 'Block',
      from: TIME_OPTS[0],
      to: TIME_OPTS[TIME_OPTS.length - 1],
      weeks: DEFAULT_WEEKS,
    },
    validate: BULK_VALIDATORS,
    onSubmit: () => setConfirmKey(crypto.randomUUID()),
  });

  const { values } = form;
  const scope = scopeOf(values.scopeLabel);
  const oneDoctor = scope !== 'all-doctors';
  const weekCount = Number(values.weeks.split(' ')[0]) || 1;
  const timeFrom = timeLabelToHhMm(values.from);
  const timeTo = timeLabelToHhMm(values.to);

  const request = useMemo<BulkSlotRequest | null>(() => {
    if (!form.isValid || !timeFrom || !timeTo) return null;
    if (oneDoctor && !values.doctorId) return null;
    return {
      action: values.action === 'Block' ? 'block' : 'open',
      scope: {
        days:
          scope === 'weekday'
            ? { kind: 'weekday', weekday: isoWeekdayIndex(date), weeks: weekCount }
            : { kind: 'date', date },
        doctorId: oneDoctor ? values.doctorId : null,
        departmentId: oneDoctor ? null : departmentId,
        timeFrom,
        timeTo,
      },
    };
  }, [
    form.isValid,
    timeFrom,
    timeTo,
    oneDoctor,
    values.doctorId,
    values.action,
    scope,
    date,
    weekCount,
    departmentId,
  ]);

  const preview = useBulkSlotsPreviewQuery(request);
  const result: BulkSlotResult | null = preview.data ?? null;
  const count = result?.affectedCount ?? 0;
  const bookings = result?.affectedBookings ?? [];
  const verb = values.action === 'Block' ? 'blocked' : 'opened';

  const doctorName = doctors.find((d) => d.id === values.doctorId)?.name ?? 'this doctor';
  const scopeCopy =
    scope === 'all-doctors'
      ? `every doctor on ${formatIsoDayLabel(date)}`
      : scope === 'one-doctor'
        ? `${doctorName} on ${formatIsoDayLabel(date)}`
        : `${doctorName} on the next ${plural(weekCount, weekday)}, counting from today`;

  const skippedCopy = result
    ? [
        result.skippedPast > 0 ? `${plural(result.skippedPast, 'past slot')} skipped` : '',
        values.action === 'Open' && result.skippedBooked > 0
          ? `${plural(result.skippedBooked, 'booked slot')} left as they are`
          : '',
      ]
        .filter(Boolean)
        .join(', ')
    : '';

  const hint = !request
    ? 'Fix the highlighted fields to see how many slots this covers.'
    : preview.isPending
      ? 'Counting the slots in that range…'
      : preview.isLoadingError
        ? isFailure(preview.error)
          ? preview.error.message
          : APPLY_FAILED
        : count === 0
          ? `No ${values.action === 'Block' ? 'open or booked' : 'blocked'} slots in that range for ${scopeCopy}.`
          : `${plural(count, 'slot')} will be ${verb} for ${scopeCopy}.${
              skippedCopy ? ` ${skippedCopy}.` : ''
            }${
              bookings.length > 0
                ? ` ${plural(bookings.length, 'booking')} will be cancelled with a full refund.`
                : ''
            }`;
  const isReady = preview.isSuccess && count > 0;

  const handleApply = (): void => {
    if (!request || !confirmKey) return;
    apply.mutate(
      { request, idempotencyKey: confirmKey },
      {
        onSuccess: (done) => {
          const cancelled = done.affectedBookings.length;
          toast(
            `${plural(done.affectedCount, 'slot')} ${verb}${
              cancelled > 0 ? `, ${plural(cancelled, 'booking')} cancelled and refunded` : ''
            }`,
            'success',
          );
          setConfirmKey(null);
          onClose();
        },
        onError: (error) => toast(isFailure(error) ? error.message : APPLY_FAILED, 'error', error),
      },
    );
  };

  const confirming = confirmKey !== null;
  const confirmBody =
    values.action === 'Block'
      ? `Block ${plural(count, 'slot')} for ${scopeCopy}? Patients can no longer book them in the Medibook app.${
          bookings.length > 0
            ? ` This also cancels ${plural(bookings.length, 'booking')} with a full refund: ${bookingsCopy(bookings)}.`
            : ''
        }`
      : `Open ${plural(count, 'slot')} for ${scopeCopy}? They become bookable in the Medibook app again.`;

  return (
    <>
      <FormModal
        dirty={form.isDirty}
        open={!confirming}
        onClose={onClose}
        title="Bulk Update Slots"
        width={600}
        onSubmit={form.handleSubmit}
        submitLabel={
          count === 0 ? `${values.action} slots` : `${values.action} ${plural(count, 'slot')}`
        }
        submitVariant={values.action === 'Block' ? 'danger' : 'primary'}
        disabled={!isReady}
      >
        <div className="flex flex-col gap-4.5">
          <Field label="Apply to" required>
            <Select
              value={values.scopeLabel}
              options={Object.values(scopeLabels)}
              onChange={(v) => form.setField('scopeLabel', v)}
            />
          </Field>
          {oneDoctor && (
            <Field label="Doctor" required>
              <Select
                value={doctorName}
                options={doctors.map((d) => d.name)}
                onChange={(name) =>
                  form.setField(
                    'doctorId',
                    doctors.find((d) => d.name === name)?.id ?? values.doctorId,
                  )
                }
              />
            </Field>
          )}
          {scope === 'weekday' && (
            <Field
              label="Repeat for"
              hint={`Counts from today: the next ${weekCount} ${weekday}s, whichever date the grid shows.`}
            >
              <Select
                value={values.weeks}
                options={WEEK_OPTIONS}
                onChange={(v) => form.setField('weeks', v)}
              />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-4.5">
            <Field label="From" required>
              <Select
                value={values.from}
                options={TIME_OPTS}
                onChange={(v) => form.setField('from', v)}
              />
            </Field>
            <Field
              label="To"
              required
              error={form.errorFor('to')}
              hint="Covers slots that start at or after From and end by To."
            >
              <Select
                value={values.to}
                options={TIME_OPTS}
                onChange={(v) => form.setField('to', v)}
                onBlur={() => form.blurField('to')}
              />
            </Field>
          </div>
          <Field label="Action" required>
            <Select
              value={values.action}
              options={ACTION_OPTIONS}
              onChange={(v) => form.setField('action', v as BulkAction)}
            />
          </Field>
          <div
            role="status"
            className={cn(
              'text-body flex items-center gap-2 rounded-md px-3.5 py-3',
              isReady
                ? 'bg-bg-tint text-text-navy'
                : 'border-border-soft text-text-muted border border-dashed',
            )}
          >
            <Icon
              name={
                preview.isLoadingError || bookings.length > 0
                  ? 'triangle-alert'
                  : isReady
                    ? 'layers'
                    : 'circle-alert'
              }
              size={16}
              className={cn('flex-none', bookings.length > 0 && 'text-d-600')}
            />
            <span>{hint}</span>
            {preview.isLoadingError && (
              <button
                type="button"
                onClick={() => void preview.refetch()}
                className="text-body text-blue cursor-pointer whitespace-nowrap underline"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </FormModal>

      <ConfirmModal
        open={confirming}
        danger={values.action === 'Block'}
        confirmLabel={
          apply.isPending
            ? 'Applying…'
            : bookings.length > 0
              ? `Block and cancel ${plural(bookings.length, 'booking')}`
              : `${values.action} ${plural(count, 'slot')}`
        }
        title={values.action === 'Block' ? 'Block Slots' : 'Open Slots'}
        body={confirmBody}
        onClose={() => setConfirmKey(null)}
        onConfirm={() => {
          if (!apply.isPending) handleApply();
        }}
      />
    </>
  );
}
