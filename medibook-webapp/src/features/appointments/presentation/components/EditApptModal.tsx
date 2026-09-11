import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { money } from '@/shared/lib/format';
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
import { useCatalogStore } from '@/features/doctors/application/store/catalog.store';
import {
  selectDepartments,
  selectDoctorNames,
  useCatalogDepartments,
  useCatalogDoctorNames,
  useCatalogFee,
} from '@/features/doctors/application/store/catalog.selectors';
import type {
  Appointment,
  Department,
} from '@/features/appointments/application/store/appointments.types';

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

interface EditForm {
  dept: Department;
  doctor: string;
  iso: string;
  time: string;
  remark: string;
}

/** Inline field errors instead of the old "Select department and doctor" toast. */
const VALIDATORS: FormValidators<EditForm> = {
  dept: (value) =>
    selectDepartments(useCatalogStore.getState()).includes(value)
      ? undefined
      : 'Choose a department.',
  doctor: (value, values) => {
    if (value.trim() === '') return 'Choose a doctor.';
    const doctors = selectDoctorNames(useCatalogStore.getState(), values.dept);
    return doctors.includes(value) ? undefined : 'That doctor does not work in this department.';
  },
  iso: (value) => {
    const raw = value.trim();
    if (raw === '') return 'Pick a date.';
    if (!ISO_DATE_PATTERN.test(raw)) return 'Enter a valid date.';
    if (Number.isNaN(new Date(`${raw}T00:00:00`).getTime())) return 'Enter a valid date.';
    if (isPastISO(raw)) return 'The date cannot be in the past.';
    return undefined;
  },
  time: (value) =>
    TIME_SLOTS.includes(value) ? undefined : 'Pick an appointment time from the list.',
};

interface EditApptModalProps {
  appt: Appointment | null;
  onClose: () => void;
}

/** Full edit: dept/doctor/date/time/note (design `Flows.jsx` `EditApptModal`). */
function EditApptForm({ appt, onClose }: { appt: Appointment; onClose: () => void }) {
  const editAppt = useAppointmentsStore((s) => s.editAppt);
  const form = useForm<EditForm>({
    initial: {
      dept: appt.dept,
      doctor: appt.doctor,
      iso: relToISOLocal(appt.date),
      time: appt.time,
      remark: appt.remark || '',
    },
    validate: VALIDATORS,
    onSubmit: (v) => {
      editAppt(appt.id, {
        dept: v.dept,
        doctor: v.doctor,
        date: isoToRelLocal(v.iso),
        time: v.time,
        remark: v.remark,
      });
      onClose();
    },
  });

  // Departments and doctors come from the hospital's own catalogue, so a
  // department or doctor added through Doctors & Departments appears here
  // immediately (audit 2.6.3).
  const departments = useCatalogDepartments();
  const deptDoctors = useCatalogDoctorNames(form.values.dept);

  const onDept = (v: string): void => {
    if (!departments.includes(v)) return;
    // Clearing the doctor keeps the pair valid; its error appears on submit.
    form.setValues({ dept: v, doctor: '' });
  };

  // The doctor's own fee wins over the department default; fall back to the
  // amount already on the appointment.
  const catalogFee = useCatalogFee(form.values.doctor || form.values.dept);
  const fee = catalogFee || appt.amount;

  return (
    <FormModal
      open
      onClose={onClose}
      title="Edit Appointment"
      width={560}
      onSubmit={form.handleSubmit}
      submitLabel="Save Changes"
      busy={form.submitting}
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-4.5">
        <Field label="Department" required error={form.errorFor('dept')}>
          <Select value={form.values.dept} options={departments} onChange={onDept} />
        </Field>
        <Field label="Doctor" required error={form.errorFor('doctor')}>
          <Select
            value={form.values.doctor}
            placeholder={form.values.dept ? 'Select Doctor' : 'Select department first'}
            options={deptDoctors}
            onChange={(v) => form.setField('doctor', v)}
            onBlur={() => form.blurField('doctor')}
          />
        </Field>
        <Field label="Date" required error={form.errorFor('iso')}>
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
        <Field label="Time" required error={form.errorFor('time')}>
          <Select
            value={form.values.time}
            options={TIME_SLOTS}
            onChange={(v) => form.setField('time', v)}
            onBlur={() => form.blurField('time')}
          />
        </Field>
        <Field label="Note" className="col-span-full">
          {(field) => (
            <textarea
              id={field.id}
              value={form.values.remark}
              onChange={(e) => form.setField('remark', e.target.value)}
              placeholder="Add any relevant notes..."
              className="rounded-input border-border text-body-lg text-text-strong h-20 w-full resize-none border p-3"
            ></textarea>
          )}
        </Field>
      </div>
      <div className="text-body text-text-body mt-4 flex items-center gap-2">
        <Icon name="indian-rupee" size={16} className="text-text-muted" /> Consultation fee:{' '}
        <b className="tabular-nums">{money(fee)}</b>
        {fee !== appt.amount && (
          <span className="text-caption text-text-muted">(was {money(appt.amount)})</span>
        )}
      </div>
      {appt.payment === 'Paid' && fee !== appt.amount && (
        <div className="text-caption text-y-700 bg-y-100 mt-2.5 rounded-md px-3 py-2.25">
          Fee changed after payment — settle the difference at the desk.
        </div>
      )}
    </FormModal>
  );
}

/** Keyed wrapper: a new appointment gets a fresh form, with no prop-to-state effect. */
export function EditApptModal({ appt, onClose }: EditApptModalProps) {
  if (!appt) return null;
  return <EditApptForm key={appt.id} appt={appt} onClose={onClose} />;
}
