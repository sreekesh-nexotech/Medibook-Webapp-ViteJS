import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { Avatar } from '@/shared/ui/Avatar';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { Select } from '@/shared/ui/Select';

import { useAppointmentsStore } from '@/features/appointments/application/store/appointments.store';
import {
  isoToRelLocal,
  isPastISO,
  relToISOLocal,
  todayISO,
} from '@/features/appointments/application/store/appointments.logic';
import type { Appointment } from '@/features/appointments/application/store/appointments.types';

const TIME_SLOTS = [
  '9:00 am',
  '9:30 am',
  '10:00 am',
  '10:30 am',
  '11:00 am',
  '11:30 am',
  '12:00 pm',
  '2:00 pm',
  '3:00 pm',
  '4:00 pm',
  '5:00 pm',
];

/** Native date-input styling — the design's `flowDateInput`. */
const dateInputClass =
  'rounded-input border-border text-body text-text-strong h-13.5 w-full border bg-white px-4';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface RescheduleForm {
  iso: string;
  time: string;
}

/**
 * Audit 3.5.1 — "the reschedule dialog checks nothing". Both fields are
 * validated, inline under the control, and re-checked while typing once
 * touched (`useForm`), so the message clears only when the value is actually
 * fixed. The past-date check uses the feature's local-date helper, never
 * `relToISO`, which returns yesterday in IST.
 */
const VALIDATORS: FormValidators<RescheduleForm> = {
  iso: (value) => {
    const raw = value.trim();
    if (raw === '') return 'Pick a new date.';
    if (!ISO_DATE_PATTERN.test(raw)) return 'Enter a valid date.';
    if (Number.isNaN(new Date(`${raw}T00:00:00`).getTime())) return 'Enter a valid date.';
    if (isPastISO(raw)) return 'The new date cannot be in the past.';
    return undefined;
  },
  time: (value) => {
    if (value.trim() === '') return 'Pick a new time slot.';
    return TIME_SLOTS.includes(value) ? undefined : 'Pick a time slot from the list.';
  },
};

interface RescheduleModalProps {
  appt: Appointment | null;
  onClose: () => void;
  onCancelInstead?: () => void;
}

/**
 * Move an appointment's date/time, same doctor (design `Flows.jsx`
 * `RescheduleModal`). Mounted per appointment (see `RescheduleModal`), so the
 * form starts from the right values without syncing props into state in an
 * effect.
 */
function RescheduleFormBody({
  appt,
  onClose,
  onCancelInstead,
}: RescheduleModalProps & { appt: Appointment }) {
  const reschedule = useAppointmentsStore((s) => s.reschedule);
  const form = useForm<RescheduleForm>({
    initial: { iso: relToISOLocal(appt.date), time: appt.time },
    validate: VALIDATORS,
    onSubmit: ({ iso, time }) => {
      reschedule(appt.id, { date: isoToRelLocal(iso), time });
      onClose();
    },
  });

  return (
    <FormModal
      open
      onClose={onClose}
      title="Reschedule Appointment"
      width={560}
      onSubmit={form.handleSubmit}
      submitLabel="Save Changes"
      busy={form.submitting}
    >
      <div className="flex flex-col gap-4">
        <div className="bg-blue-soft-bg flex items-center gap-3 rounded-md px-3.5 py-3">
          <Avatar name={appt.name} size={38} />
          <div className="flex-1">
            <div className="text-body text-text-strong font-medium">{appt.name}</div>
            <div className="text-caption text-text-muted">
              {appt.doctor} · {appt.dept}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="New Date" required error={form.errorFor('iso')}>
            {(field) => (
              <input
                type="date"
                id={field.id}
                value={form.values.iso}
                min={todayISO()}
                aria-describedby={field.describedById}
                aria-invalid={field.invalid || undefined}
                onChange={(e) => form.setField('iso', e.target.value)}
                onBlur={() => form.blurField('iso')}
                className={dateInputClass}
              />
            )}
          </Field>
          <Field label="New Time" required error={form.errorFor('time')}>
            <Select
              value={form.values.time}
              placeholder="Select a slot"
              options={TIME_SLOTS}
              onChange={(v) => form.setField('time', v)}
              onBlur={() => form.blurField('time')}
            />
          </Field>
        </div>
        <div className="text-caption text-text-muted bg-grey-200 flex items-center gap-2 rounded-md px-3 py-2.5">
          <Icon name="info" size={15} className="flex-none" />{' '}
          <span>
            Same doctor only. Need a different doctor?{' '}
            <button
              type="button"
              onClick={() => {
                onClose();
                onCancelInstead?.();
              }}
              className="text-blue cursor-pointer font-semibold"
            >
              Cancel &amp; rebook
            </button>
            .
          </span>
        </div>
      </div>
    </FormModal>
  );
}

/** Keyed wrapper: a new appointment gets a fresh form, with no prop-to-state effect. */
export function RescheduleModal({ appt, onClose, onCancelInstead }: RescheduleModalProps) {
  if (!appt) return null;
  return (
    <RescheduleFormBody
      key={appt.id}
      appt={appt}
      onClose={onClose}
      onCancelInstead={onCancelInstead}
    />
  );
}
