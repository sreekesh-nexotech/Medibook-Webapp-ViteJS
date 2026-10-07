import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { email, pincode, required } from '@/shared/lib/validate';
import { FormModal } from '@/shared/ui/FormModal';
import { OpsField } from '@/shared/ui/OpsField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import type {
  HospitalProfileChanges,
  PlatformHospitalDetail,
} from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import { useUpdatePlatformHospitalMutation } from '@/features/ops-hospitals/application/queries/useUpdatePlatformHospitalMutation';

/** Backend patterns (`PatchedPlatformHospitalProfileRequest`). */
const GSTIN_PATTERN = /^[0-9]{2}[A-Z0-9]{13}$/;
const E164_PATTERN = /^\+[1-9]\d{7,14}$/;
const NAME_MAX = 200;
const SHORT_MAX = 100;
const FIELD_HEIGHT = 44;
const SAVE_FAILED = 'The profile could not be saved. Please try again.';

interface ProfileForm {
  name: string;
  legalName: string;
  gstin: string;
  registrationNo: string;
  email: string;
  phone: string;
  website: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
}

type FormKey = keyof ProfileForm;

/** Spaces and dashes people type inside phone numbers. */
function compactPhone(value: string): string {
  return value.replace(/[\s-]/g, '');
}

function maxLength(value: string, max: number, label: string): string | undefined {
  return value.trim().length <= max ? undefined : `${label} must be ${max} characters or fewer.`;
}

const VALIDATORS: FormValidators<ProfileForm> = {
  name: (v) => required(v, 'Hospital name') ?? maxLength(v, NAME_MAX, 'Hospital name'),
  legalName: (v) => maxLength(v, NAME_MAX, 'Legal name'),
  gstin: (v) =>
    v.trim() === '' || GSTIN_PATTERN.test(v.trim().toUpperCase())
      ? undefined
      : 'A GSTIN is 15 characters: 2 digits, then 13 letters or digits.',
  registrationNo: (v) => maxLength(v, SHORT_MAX, 'Registration number'),
  email: (v) => email(v),
  phone: (v) =>
    E164_PATTERN.test(compactPhone(v))
      ? undefined
      : 'Enter the number with its country code, e.g. +91 484 270 1000.',
  website: (v) => maxLength(v, NAME_MAX, 'Website'),
  addressLine1: (v) => required(v, 'Address') ?? maxLength(v, NAME_MAX, 'Address'),
  addressLine2: (v) => maxLength(v, NAME_MAX, 'Address line 2'),
  city: (v) => required(v, 'City') ?? maxLength(v, SHORT_MAX, 'City'),
  state: (v) => required(v, 'State') ?? maxLength(v, SHORT_MAX, 'State'),
  pincode: (v) => pincode(v),
};

/** Backend field → form field, for a 400's per-field messages. */
const SERVER_FIELDS: Readonly<Record<string, FormKey>> = {
  name: 'name',
  legal_name: 'legalName',
  gstin: 'gstin',
  registration_no: 'registrationNo',
  email: 'email',
  phone_e164: 'phone',
  website: 'website',
  address_line1: 'addressLine1',
  address_line2: 'addressLine2',
  city: 'city',
  state: 'state',
  pincode: 'pincode',
};

function toForm(h: PlatformHospitalDetail): ProfileForm {
  return {
    name: h.name,
    legalName: h.legalName ?? '',
    gstin: h.gstin ?? '',
    registrationNo: h.registrationNo ?? '',
    email: h.email,
    phone: h.phone,
    website: h.website ?? '',
    addressLine1: h.addressLine1,
    addressLine2: h.addressLine2 ?? '',
    city: h.city,
    state: h.state,
    pincode: h.pincode,
  };
}

/** Empty optional text is stored as `null`. */
function optional(value: string): string | null {
  return value.trim() || null;
}

/** Only the fields that differ from what the hospital has now. */
function toChanges(v: ProfileForm, h: PlatformHospitalDetail): HospitalProfileChanges {
  const gstin = optional(v.gstin.toUpperCase());
  const phone = compactPhone(v.phone);
  return {
    ...(v.name.trim() !== h.name && { name: v.name.trim() }),
    ...(optional(v.legalName) !== h.legalName && { legalName: optional(v.legalName) }),
    ...(gstin !== h.gstin && { gstin }),
    ...(optional(v.registrationNo) !== h.registrationNo && {
      registrationNo: optional(v.registrationNo),
    }),
    ...(v.email.trim() !== h.email && { email: v.email.trim() }),
    ...(phone !== h.phone && { phone }),
    ...(optional(v.website) !== h.website && { website: optional(v.website) }),
    ...(v.addressLine1.trim() !== h.addressLine1 && { addressLine1: v.addressLine1.trim() }),
    ...(optional(v.addressLine2) !== h.addressLine2 && {
      addressLine2: optional(v.addressLine2),
    }),
    ...(v.city.trim() !== h.city && { city: v.city.trim() }),
    ...(v.state.trim() !== h.state && { state: v.state.trim() }),
    ...(v.pincode.trim() !== h.pincode && { pincode: v.pincode.trim() }),
  };
}

interface HospitalEditProfileModalProps {
  h: PlatformHospitalDetail;
  onClose: () => void;
}

/**
 * Correct a hospital's registered details after onboarding — name, legal and
 * tax identity, contact and address (`PATCH /platform/hospitals/{id}`). Only
 * changed fields are sent, guarded by the version this form was opened on
 * (`If-Match`), so a concurrent edit is refused instead of overwritten.
 * Receipts copy the legal name and GSTIN when issued, so a correction shows
 * on receipts from then on.
 */
export function HospitalEditProfileModal({ h, onClose }: HospitalEditProfileModalProps) {
  const update = useUpdatePlatformHospitalMutation();
  const [serverErrors, setServerErrors] = useState<Partial<Record<FormKey, string>>>({});

  const form = useForm<ProfileForm>({
    initial: toForm(h),
    validate: VALIDATORS,
    onSubmit: async (values) => {
      const changes = toChanges(values, h);
      if (Object.keys(changes).length === 0) {
        onClose();
        return;
      }
      setServerErrors({});
      try {
        await update.mutateAsync({ id: h.id, changes, version: h.version });
        toast(`${values.name.trim()} updated.`, 'success');
        onClose();
      } catch (error) {
        if (!isFailure(error)) {
          toast(SAVE_FAILED, 'error');
          return;
        }
        const mapped: Partial<Record<FormKey, string>> = {};
        for (const [key, messages] of Object.entries(error.fieldErrors)) {
          const field = SERVER_FIELDS[key];
          if (field && messages[0]) mapped[field] = messages[0];
        }
        setServerErrors(mapped);
        toast(
          error.code === 'CONFLICT_VERSION'
            ? 'Someone else changed this hospital while you were editing. Close this form, check their changes, then try again.'
            : error.message,
          'error',
          error,
        );
      }
    },
  });

  const { values } = form;
  const errorFor = (key: FormKey) => form.errorFor(key) ?? serverErrors[key];

  const text = (
    key: FormKey,
    extra: { placeholder?: string; inputMode?: 'tel' | 'email' | 'url' | 'numeric' } = {},
  ) => (
    <TextInput
      value={values[key]}
      onChange={(v) => {
        form.setField(key, v);
        if (serverErrors[key]) setServerErrors((e) => ({ ...e, [key]: undefined }));
      }}
      onBlur={() => form.blurField(key)}
      height={FIELD_HEIGHT}
      {...extra}
    />
  );

  return (
    <FormModal
      dirty={form.isDirty}
      open
      onClose={onClose}
      title={`Edit ${h.name}`}
      width={720}
      onSubmit={form.handleSubmit}
      submitLabel="Save Changes"
      busy={form.submitting}
      disabled={!form.isDirty}
    >
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-4">
          <SectionTitle>Identity</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <OpsField label="Hospital Name" required error={errorFor('name')}>
              {text('name')}
            </OpsField>
            <OpsField
              label="Legal Name"
              error={errorFor('legalName')}
              hint="As registered; printed on receipts."
            >
              {text('legalName')}
            </OpsField>
            <OpsField
              label="GSTIN"
              error={errorFor('gstin')}
              hint="Printed on receipts issued from now on."
            >
              {text('gstin', { placeholder: '15 characters' })}
            </OpsField>
            <OpsField label="Registration No." error={errorFor('registrationNo')}>
              {text('registrationNo')}
            </OpsField>
          </div>
        </section>
        <section className="flex flex-col gap-4">
          <SectionTitle>Contact</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <OpsField label="Email" required error={errorFor('email')}>
              {text('email', { inputMode: 'email' })}
            </OpsField>
            <OpsField
              label="Phone"
              required
              error={errorFor('phone')}
              hint="With the country code."
            >
              {text('phone', { inputMode: 'tel', placeholder: '+91 484 270 1000' })}
            </OpsField>
            <OpsField label="Website" error={errorFor('website')}>
              {text('website', { inputMode: 'url' })}
            </OpsField>
          </div>
        </section>
        <section className="flex flex-col gap-4">
          <SectionTitle>Address</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <OpsField label="Address" required error={errorFor('addressLine1')}>
              {text('addressLine1')}
            </OpsField>
            <OpsField label="Address Line 2" error={errorFor('addressLine2')}>
              {text('addressLine2')}
            </OpsField>
            <OpsField label="City" required error={errorFor('city')}>
              {text('city')}
            </OpsField>
            <OpsField label="State" required error={errorFor('state')}>
              {text('state')}
            </OpsField>
            <OpsField label="PIN Code" required error={errorFor('pincode')}>
              {text('pincode', { inputMode: 'numeric' })}
            </OpsField>
          </div>
        </section>
      </div>
    </FormModal>
  );
}
