import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { todayISO } from '@/shared/lib/format';
import { email as emailRule, notFutureDate, phoneIN, required } from '@/shared/lib/validate';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import { useCreatePatientMutation } from '@/features/patients/application/queries/useCreatePatientMutation';
import { useUpdatePatientMutation } from '@/features/patients/application/queries/useUpdatePatientMutation';
import type {
  PatientDemographics,
  PatientRecord,
} from '@/features/patients/domain/entities/patients.entities';
import {
  GENDER_LABELS,
  GENDER_OPTIONS,
  diffDemographics,
  displayPhone,
  genderFromLabel,
  genderLabel,
  saveErrorMessage,
  splitFullName,
  toE164,
} from '@/features/patients/presentation/components/patientsFormat';

interface PatientModalProps {
  open: boolean;
  /** Absent = "Add Patient" (new); present = "Edit Patient". */
  patient?: PatientRecord;
  onClose: () => void;
  /** Called with the MRN of the saved (or already-registered) record. */
  onSaved?: (mrn: string) => void;
}

interface PatientForm {
  name: string;
  phone: string;
  dob: string;
  gender: string;
  email: string;
  address: string;
}

const BLANK: PatientForm = {
  name: '',
  phone: '',
  dob: '',
  gender: GENDER_LABELS.male,
  email: '',
  address: '',
};

const SAVE_FAILED = 'The patient could not be saved. Please try again.';

/**
 * Inline field errors (audit 3.5.1/3.5.4); the phone is checked against
 * `phoneIN`. Date of birth is optional, but never in the future.
 */
const VALIDATORS: FormValidators<PatientForm> = {
  name: (value) => required(value, 'Patient name'),
  phone: (value) => phoneIN(value),
  dob: (value) => (value.trim() === '' ? undefined : notFutureDate(value, 'Date of birth')),
  email: (value) => (value.trim() === '' ? undefined : emailRule(value)),
};

function toForm(p: PatientRecord): PatientForm {
  return {
    name: p.fullName,
    phone: displayPhone(p.phone),
    dob: p.dateOfBirth ?? '',
    gender: genderLabel(p.gender) || GENDER_LABELS.male,
    email: p.email ?? '',
    // The single field edits the first address line; city, state and
    // pincode are kept as they are.
    address: p.addressLine1 ?? '',
  };
}

function toDemographics(v: PatientForm): PatientDemographics {
  const blankToNull = (s: string): string | null => (s.trim() === '' ? null : s.trim());
  return {
    ...splitFullName(v.name),
    phone: toE164(v.phone),
    email: blankToNull(v.email),
    dateOfBirth: blankToNull(v.dob),
    gender: genderFromLabel(v.gender),
    addressLine1: blankToNull(v.address),
  };
}

/**
 * Add / Edit patient modal — identity + contact only (Medibook stores no
 * clinical data), on `FormModal` so Enter submits. Saves through the
 * hospital API: a new record gets its MRN from the server, and an edit may
 * become a change request when the hospital requires admin approval.
 */
function PatientRecordForm({ patient, onClose, onSaved }: Omit<PatientModalProps, 'open'>) {
  const isNew = !patient;
  const createMutation = useCreatePatientMutation();
  const updateMutation = useUpdatePatientMutation();

  const save = async (v: PatientForm): Promise<void> => {
    const demographics = toDemographics(v);
    try {
      if (!patient) {
        const { patient: saved, isExisting } = await createMutation.mutateAsync(demographics);
        toast(
          isExisting ? `Already registered as ${saved.mrn} — opened that record` : 'Patient added',
          isExisting ? 'info' : 'success',
        );
        onSaved?.(saved.mrn);
        onClose();
        return;
      }
      const changes = diffDemographics(patient, demographics);
      if (Object.keys(changes).length === 0) {
        onClose();
        return;
      }
      const outcome = await updateMutation.mutateAsync({
        id: patient.id,
        changes,
        version: patient.version,
      });
      toast(
        outcome.status === 'applied'
          ? 'Patient details updated'
          : 'Changes sent to an admin for approval',
        outcome.status === 'applied' ? 'success' : 'info',
      );
      onSaved?.(patient.mrn);
      onClose();
    } catch (error) {
      toast(saveErrorMessage(error, SAVE_FAILED), 'error');
    }
  };

  const form = useForm<PatientForm>({
    initial: patient ? toForm(patient) : BLANK,
    validate: VALIDATORS,
    onSubmit: save,
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
        <Field label="Date of Birth" error={form.errorFor('dob')}>
          <TextInput
            type="date"
            value={form.values.dob}
            onChange={(v) => form.setField('dob', v)}
            onBlur={() => form.blurField('dob')}
            autoComplete="bday"
            max={todayISO()}
          />
        </Field>
        <Field label="Gender">
          <Select
            value={form.values.gender}
            options={GENDER_OPTIONS}
            onChange={(v) => form.setField('gender', v)}
          />
        </Field>
        <Field label="Email" error={form.errorFor('email')} className="col-span-full">
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
        <Field label="Address" className="col-span-full">
          <TextInput
            value={form.values.address}
            onChange={(v) => form.setField('address', v)}
            autoComplete="street-address"
            placeholder="House, street, area"
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
      key={patient ? `${patient.id}:${patient.version}` : 'new'}
      patient={patient}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
