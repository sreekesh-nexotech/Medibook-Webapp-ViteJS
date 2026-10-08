import { useMemo, useState } from 'react';

import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { useHospitalToday } from '@/shared/hooks/useHospitalTime';
import { email as emailRule, notFutureDate, required } from '@/shared/lib/validate';
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
  PatientMatchCandidate,
  PatientRecord,
} from '@/features/patients/domain/entities/patients.entities';
import { PatientMatchReview } from '@/features/patients/presentation/components/PatientMatchReview';
import {
  GENDER_NOT_SPECIFIED,
  GENDER_OPTIONS,
  PHONE_INPUT_MAX_LENGTH,
  diffDemographics,
  displayPhone,
  genderFromLabel,
  genderLabel,
  phoneError,
  pincodeError,
  saveErrorMessage,
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
  firstName: string;
  lastName: string;
  phone: string;
  dob: string;
  gender: string;
  email: string;
  address1: string;
  address2: string;
  address3: string;
  city: string;
  state: string;
  pincode: string;
  legacyMrn: string;
}

const BLANK: PatientForm = {
  firstName: '',
  lastName: '',
  phone: '',
  dob: '',
  gender: GENDER_NOT_SPECIFIED,
  email: '',
  address1: '',
  address2: '',
  address3: '',
  city: '',
  state: '',
  pincode: '',
  legacyMrn: '',
};

const SAVE_FAILED = 'The patient could not be saved. Please try again.';

/** Backend limits (`WalkInNewPatientSerializer`). */
const NAME_MAX = 100;
const ADDRESS_LINE_MAX = 200;
const PLACE_MAX = 100;
const LEGACY_MRN_MAX = 64;
const PINCODE_LENGTH = 6;

/**
 * Inline field errors (audit 3.5.1/3.5.4). The phone takes a 10-digit Indian
 * mobile or an international number with its country code; it is required on
 * a new record, and on an edit only when the record already has one (a phone
 * can be corrected, not silently dropped). Date of birth is optional, but
 * never after `today`, the hospital's calendar day (D-09, UAT-47).
 */
function validatorsFor(isPhoneRequired: boolean, today: string): FormValidators<PatientForm> {
  return {
    firstName: (value) => required(value, 'First name'),
    phone: (value) => phoneError(value, isPhoneRequired),
    dob: (value) =>
      value.trim() === '' ? undefined : notFutureDate(value, 'Date of birth', today),
    email: (value) => (value.trim() === '' ? undefined : emailRule(value)),
    pincode: (value) => pincodeError(value),
  };
}

function toForm(p: PatientRecord): PatientForm {
  return {
    firstName: p.firstName,
    lastName: p.lastName ?? '',
    phone: displayPhone(p.phone),
    dob: p.dateOfBirth ?? '',
    // A record with no gender must stay that way: defaulting the field would
    // turn an untouched edit into "gender changed to Male".
    gender: genderLabel(p.gender) || GENDER_NOT_SPECIFIED,
    email: p.email ?? '',
    address1: p.addressLine1 ?? '',
    address2: p.addressLine2 ?? '',
    address3: p.addressLine3 ?? '',
    city: p.city ?? '',
    state: p.state ?? '',
    pincode: p.pincode ?? '',
    legacyMrn: p.legacyMrn ?? '',
  };
}

function blankToNull(s: string): string | null {
  const trimmed = s.trim();
  return trimmed === '' ? null : trimmed;
}

/** The form as the API's demographics. The first name is never blank (validated). */
function formToDemographics(v: PatientForm): PatientDemographics {
  return {
    firstName: v.firstName.trim(),
    lastName: blankToNull(v.lastName),
    phone: toE164(v.phone),
    email: blankToNull(v.email),
    dateOfBirth: blankToNull(v.dob),
    gender: genderFromLabel(v.gender),
    addressLine1: blankToNull(v.address1),
    addressLine2: blankToNull(v.address2),
    addressLine3: blankToNull(v.address3),
    city: blankToNull(v.city),
    state: blankToNull(v.state),
    pincode: blankToNull(v.pincode),
    legacyMrn: blankToNull(v.legacyMrn),
  };
}

/**
 * What the desk is told after registering: a new MRN, an existing record, a
 * linked account. The server reports a link only for the same person, never
 * for a dependant the registration created (M-15), so this never over-promises.
 */
function createdMessage(patient: PatientRecord, isExisting: boolean): string {
  if (isExisting) return `Already registered as ${patient.mrn} — opened that record`;
  return patient.isLinked
    ? `Patient added as ${patient.mrn} and linked to their Medibook account`
    : `Patient added as ${patient.mrn}`;
}

/** The fields the server matches people on; a change after a review means a fresh check. */
function matchKey(d: PatientDemographics): string {
  return [d.phone, d.firstName.toLowerCase(), d.lastName?.toLowerCase(), d.dateOfBirth].join('|');
}

/** Possible duplicates the server returned, for the details they were checked against. */
interface MatchReviewState {
  readonly candidates: readonly PatientMatchCandidate[];
  readonly key: string;
}

/**
 * Add / Edit patient modal — identity, contact and a structured address only
 * (Medibook stores no clinical data; CLAUDE.md §7 has no free-text address),
 * on `FormModal` so Enter submits. Saves through the hospital API: a new
 * record gets its MRN from the server, and an edit sends only the fields that
 * changed and may become a change request when the hospital requires admin
 * approval (D-29).
 */
function PatientRecordForm({ patient, onClose, onSaved }: Omit<PatientModalProps, 'open'>) {
  const isNew = !patient;
  const isPhoneRequired = !patient || patient.phone !== null;
  const createMutation = useCreatePatientMutation();
  const updateMutation = useUpdatePatientMutation();
  const [review, setReview] = useState<MatchReviewState | null>(null);
  // A baby born today at the hospital is not "in the future" on a PC still on yesterday.
  const { today } = useHospitalToday();
  const validate = useMemo(() => validatorsFor(isPhoneRequired, today), [isPhoneRequired, today]);

  const save = async (v: PatientForm): Promise<void> => {
    const demographics = formToDemographics(v);
    try {
      if (!patient) {
        const key = matchKey(demographics);
        // A second submit after the review registers a new record anyway —
        // unless the matching details changed, which needs a fresh check.
        const outcome = await createMutation.mutateAsync({
          demographics,
          confirmNewRecord: review?.key === key,
        });
        if (outcome.status === 'matchReview') {
          setReview({ candidates: outcome.candidates, key });
          return;
        }
        const isExisting = outcome.status === 'existing';
        toast(createdMessage(outcome.patient, isExisting), isExisting ? 'info' : 'success');
        onSaved?.(outcome.patient.mrn);
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
    validate,
    onSubmit: save,
  });
  const reviewing = review !== null && review.key === matchKey(formToDemographics(form.values));

  const openCandidate = (candidate: PatientMatchCandidate): void => {
    toast(`Opened ${candidate.fullName} (${candidate.mrn})`, 'info');
    onSaved?.(candidate.mrn);
    onClose();
  };

  const text = (
    key: keyof PatientForm,
    label: string,
    options: {
      readonly required?: boolean;
      readonly maxLength?: number;
      readonly placeholder?: string;
      readonly autoComplete?: string;
      readonly hint?: string;
      readonly wide?: boolean;
      readonly inputMode?: 'text' | 'numeric' | 'tel' | 'email';
      readonly type?: string;
    } = {},
  ) => (
    <Field
      label={label}
      required={options.required}
      error={form.errorFor(key)}
      hint={options.hint}
      className={options.wide ? 'col-span-full' : undefined}
    >
      <TextInput
        value={form.values[key]}
        onChange={(v) => form.setField(key, v)}
        onBlur={() => form.blurField(key)}
        maxLength={options.maxLength}
        placeholder={options.placeholder}
        autoComplete={options.autoComplete}
        inputMode={options.inputMode}
        type={options.type}
      />
    </Field>
  );

  return (
    <FormModal
      open
      onClose={onClose}
      title={isNew ? 'Add Patient' : 'Edit Patient'}
      width={640}
      onSubmit={form.handleSubmit}
      submitLabel={reviewing ? 'Register as New Patient' : isNew ? 'Add Patient' : 'Save Changes'}
      busy={form.submitting}
    >
      {reviewing && <PatientMatchReview candidates={review.candidates} onUse={openCandidate} />}
      <div className="grid grid-cols-2 gap-x-6 gap-y-4.5">
        {text('firstName', 'First Name', {
          required: true,
          maxLength: NAME_MAX,
          autoComplete: 'given-name',
          placeholder: 'First name',
        })}
        {text('lastName', 'Last Name', {
          maxLength: NAME_MAX,
          autoComplete: 'family-name',
          placeholder: 'Last name (optional)',
        })}
        {text('phone', 'Phone Number', {
          required: isPhoneRequired,
          maxLength: PHONE_INPUT_MAX_LENGTH,
          autoComplete: 'tel',
          inputMode: 'tel',
          placeholder: '10-digit mobile',
          hint: 'For a number outside India, start with + and the country code.',
        })}
        <Field label="Date of Birth" error={form.errorFor('dob')}>
          <TextInput
            type="date"
            value={form.values.dob}
            onChange={(v) => form.setField('dob', v)}
            onBlur={() => form.blurField('dob')}
            autoComplete="bday"
            max={today}
          />
        </Field>
        <Field label="Gender">
          <Select
            value={form.values.gender}
            options={GENDER_OPTIONS}
            onChange={(v) => form.setField('gender', v)}
          />
        </Field>
        {text('email', 'Email', {
          type: 'email',
          inputMode: 'email',
          autoComplete: 'email',
          placeholder: 'name@mail.com',
        })}
        {text('address1', 'Address Line 1', {
          wide: true,
          maxLength: ADDRESS_LINE_MAX,
          autoComplete: 'address-line1',
          placeholder: 'House, street',
        })}
        {text('address2', 'Address Line 2', {
          maxLength: ADDRESS_LINE_MAX,
          autoComplete: 'address-line2',
          placeholder: 'Area, locality',
        })}
        {text('address3', 'Address Line 3', {
          maxLength: ADDRESS_LINE_MAX,
          autoComplete: 'address-line3',
          placeholder: 'Landmark (optional)',
        })}
        {text('city', 'City', { maxLength: PLACE_MAX, autoComplete: 'address-level2' })}
        {text('state', 'State', { maxLength: PLACE_MAX, autoComplete: 'address-level1' })}
        {text('pincode', 'PIN Code', {
          maxLength: PINCODE_LENGTH,
          inputMode: 'numeric',
          autoComplete: 'postal-code',
          placeholder: '6 digits',
        })}
        {text('legacyMrn', 'Legacy MR Number', {
          maxLength: LEGACY_MRN_MAX,
          hint: 'The number from your earlier system. Searchable; the Medibook MR number stays primary.',
        })}
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
