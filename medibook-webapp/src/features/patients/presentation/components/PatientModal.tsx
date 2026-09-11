import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { email as emailRule, phoneIN, positiveAmount, required } from '@/shared/lib/validate';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import { usePatientsStore } from '@/features/patients/application/store/patients.store';
import type { Gender, PatientStatus } from '@/features/patients/application/store/patients.types';

/**
 * Loose view of the record being edited — the Patient Detail screen may pass a
 * real patient record OR (for patients that exist only as appointment history)
 * an appointment-derived object, exactly like the prototype's `rec || p`.
 */
export interface PatientModalPatient {
  readonly mrn: string;
  readonly name?: string;
  readonly phone?: string;
  readonly age?: number;
  readonly gender?: Gender;
  readonly email?: string;
  readonly address?: string;
  readonly status?: string;
}

interface PatientModalProps {
  open: boolean;
  /** Absent = "Add Patient" (new); present = "Edit Patient". */
  patient?: PatientModalPatient;
  onClose: () => void;
  onSaved?: (mrn: string) => void;
}

interface PatientForm {
  name: string;
  phone: string;
  age: string;
  gender: Gender;
  email: string;
  address: string;
  status: PatientStatus;
}

const BLANK: PatientForm = {
  name: '',
  phone: '',
  age: '',
  gender: 'Male',
  email: '',
  address: '',
  status: 'Active',
};

/** Oldest age the desk can type before it is obviously a typo. */
const MAX_AGE = 120;

/**
 * Inline field errors instead of the old "Name and phone are required" toast
 * (audit 3.5.1/3.5.4) — and the phone is now checked against `phoneIN`, so a
 * 7-digit number no longer reaches the record.
 */
const VALIDATORS: FormValidators<PatientForm> = {
  name: (value) => required(value, 'Patient name'),
  phone: (value) => phoneIN(value),
  age: (value) => {
    if (value.trim() === '') return undefined;
    const invalid = positiveAmount(value, 'Age');
    if (invalid) return invalid;
    return Number(value) <= MAX_AGE ? undefined : `Age must be ${MAX_AGE} or less.`;
  },
  email: (value) => (value.trim() === '' ? undefined : emailRule(value)),
};

/**
 * Add / Edit patient modal — identity + contact only (Medibook stores no
 * clinical data). Ported 1:1 from the design prototype's `PatientModal`, on
 * `FormModal` so Enter submits.
 */
function PatientRecordForm({ patient, onClose, onSaved }: Omit<PatientModalProps, 'open'>) {
  const isNew = !patient;
  const patAdd = usePatientsStore((s) => s.patAdd);
  const patUpdate = usePatientsStore((s) => s.patUpdate);

  const form = useForm<PatientForm>({
    initial: patient
      ? {
          name: patient.name || '',
          phone: patient.phone || '',
          age: patient.age ? String(patient.age) : '',
          gender: patient.gender || 'Male',
          email: patient.email || '',
          address: patient.address || '',
          status: patient.status === 'Inactive' ? 'Inactive' : 'Active',
        }
      : BLANK,
    validate: VALIDATORS,
    onSubmit: (v) => {
      const payload = {
        name: v.name.trim(),
        phone: v.phone.trim(),
        age: Number(v.age) || 0,
        gender: v.gender,
        email: v.email.trim(),
        address: v.address.trim(),
        status: v.status,
      };
      if (!patient) {
        const mrn = patAdd(payload);
        toast('Patient added', 'success');
        onSaved?.(mrn);
      } else {
        patUpdate(patient.mrn, payload);
        toast('Patient details updated', 'success');
        onSaved?.(patient.mrn);
      }
      onClose();
    },
  });

  return (
    <FormModal
      open
      onClose={onClose}
      title={isNew ? 'Add Patient' : 'Edit Patient'}
      width={560}
      onSubmit={form.handleSubmit}
      submitLabel={isNew ? 'Add Patient' : 'Save Changes'}
      busy={form.submitting}
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-4.5">
        <Field label="Full Name" required error={form.errorFor('name')}>
          <TextInput
            value={form.values.name}
            onChange={(v) => form.setField('name', v)}
            onBlur={() => form.blurField('name')}
            autoComplete="name"
            placeholder="Patient name"
          />
        </Field>
        <Field label="Phone Number" required error={form.errorFor('phone')}>
          <TextInput
            value={form.values.phone}
            onChange={(v) => form.setField('phone', v)}
            onBlur={() => form.blurField('phone')}
            inputMode="tel"
            autoComplete="tel"
            maxLength={10}
            placeholder="10-digit mobile"
          />
        </Field>
        <Field label="Age" error={form.errorFor('age')}>
          <TextInput
            value={form.values.age}
            onChange={(v) => form.setField('age', v)}
            onBlur={() => form.blurField('age')}
            inputMode="numeric"
            placeholder="Age"
          />
        </Field>
        <Field label="Gender">
          <Select
            value={form.values.gender}
            options={['Male', 'Female', 'Other']}
            onChange={(v) => form.setField('gender', v as Gender)}
          />
        </Field>
        <Field label="Email" error={form.errorFor('email')}>
          <TextInput
            value={form.values.email}
            onChange={(v) => form.setField('email', v)}
            onBlur={() => form.blurField('email')}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="name@mail.com"
          />
        </Field>
        <Field label="Status">
          <Select
            value={form.values.status}
            options={['Active', 'Inactive']}
            onChange={(v) => form.setField('status', v as PatientStatus)}
          />
        </Field>
        <Field label="Address" className="col-span-full">
          <TextInput
            value={form.values.address}
            onChange={(v) => form.setField('address', v)}
            autoComplete="street-address"
            placeholder="Area, City"
          />
        </Field>
      </div>
      {isNew && (
        <div className="bg-blue-soft-bg text-caption text-text-muted mt-3.5 flex items-center gap-2 rounded-md px-3 py-2.5">
          <Icon name="info" size={15} className="text-blue flex-none" /> An MR Number is generated
          automatically. Medibook stores identity &amp; contact only — no clinical data.
        </div>
      )}
    </FormModal>
  );
}

/** Keyed wrapper: a new record gets a fresh form, with no prop-to-state effect. */
export function PatientModal({ open, patient, onClose, onSaved }: PatientModalProps) {
  if (!open) return null;
  return (
    <PatientRecordForm
      key={patient?.mrn ?? 'new'}
      patient={patient}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
