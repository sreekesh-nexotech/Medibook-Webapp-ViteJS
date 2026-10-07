import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { mapServerErrors } from '@/shared/lib/serverErrors';
import { email, phoneIN, pincode, required } from '@/shared/lib/validate';
import { FormErrorSummary } from '@/shared/ui/FormErrorSummary';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { OpsField } from '@/shared/ui/OpsField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import { usePlansQuery } from '@/features/ops-plans/application/queries/usePlansQuery';
import { useCreateHospitalMutation } from '@/features/ops-hospitals/application/queries/useCreateHospitalMutation';
import type {
  ConvenienceFeeKind,
  HospitalBillingPeriod,
  HospitalCreateInput,
  PlatformHospital,
} from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import {
  bookingFormatProblem,
  numberingFormatProblem,
} from '@/features/ops-hospitals/presentation/components/hospitalSettings.view';
import {
  DEFAULT_HOSPITAL_TIMEZONE,
  HOSPITAL_TIMEZONES,
} from '@/features/ops-hospitals/presentation/components/hospitals.view';

/**
 * Onboard Hospital (design `OnboardHospitalModal`) on `POST /platform/hospitals`.
 * The backend provisions the instance in onboarding — settings, roles,
 * numbering series, subscription and onboarding case — and invites the first
 * administrator, so the form collects everything that call requires. The
 * document checklist and KYC review then happen on Network › Onboarding.
 */

interface OnboardForm {
  name: string;
  slug: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  timezone: string;
  planId: string;
  billingPeriod: string;
  commissionPct: string;
  feeKind: string;
  feeValue: string;
  numberPrefix: string;
  mrnFormat: string;
  bookingFormat: string;
  receiptFormat: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPhone: string;
}

type FormKey = keyof OnboardForm;

const SLUG_PATTERN = /^[-a-zA-Z0-9_]+$/;
const PREFIX_PATTERN = /^[A-Z0-9]{1,12}$/;
/** Any number with its country code — landlines included (10·F5). */
const E164_PATTERN = /^\+[1-9]\d{7,14}$/;
const INDIA_DIAL_CODE = '+91';
const BP_PER_PERCENT = 100;
const PAISE_PER_RUPEE = 100;
const MAX_PERCENT = 100;
const FIELD_HEIGHT = 44;

const BILLING_PERIODS: readonly HospitalBillingPeriod[] = ['monthly', 'yearly'];
const BILLING_PERIOD_LABEL: Readonly<Record<HospitalBillingPeriod, string>> = {
  monthly: 'Monthly',
  yearly: 'Yearly',
};
const FEE_KINDS: readonly ConvenienceFeeKind[] = ['flat', 'percent'];
const FEE_KIND_LABEL: Readonly<Record<ConvenienceFeeKind, string>> = {
  flat: 'Flat amount (₹)',
  percent: 'Percent of fee (%)',
};

/** The seeded hospitals' series formats; `{PREFIX}` is the prefix field. */
const DEFAULT_FORMATS = {
  mrn: '{PREFIX}{SEQ:6}',
  booking: '{PREFIX}-{YY}{MM}-{SEQ:5}',
  receipt: '{PREFIX}/{FY}/{SEQ:5}',
} as const;

/** `"Sunrise Multispeciality"` → `"sunrise-multispeciality"`. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function digits(value: string): string {
  return value.replace(/\D/g, '');
}

function percent(value: string, label: string): string | undefined {
  const missing = required(value, label);
  if (missing) return missing;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= MAX_PERCENT ? undefined : `${label} must be 0–100%.`;
}

/** Mirrors the server's checks (`numbering.validate_format`), so a typo is caught here (10·F4). */
function seriesFormat(value: string, label: string): string | undefined {
  const missing = required(value, label);
  if (missing) return missing;
  return numberingFormatProblem(value) ?? undefined;
}

/** Spaces, dashes and brackets people type inside phone numbers. */
function compactPhone(value: string): string {
  return value.replace(/[\s\-()]/g, '');
}

/** A hospital phone: a 10-digit Indian mobile, or any number written with its country code. */
function hospitalPhone(value: string): string | undefined {
  const compact = compactPhone(value);
  if (compact.startsWith('+')) {
    return E164_PATTERN.test(compact)
      ? undefined
      : 'Enter the number with its country code, e.g. +91 484 270 1000.';
  }
  return phoneIN(value);
}

/** E.164 for the request: a bare 10-digit number is an Indian mobile. */
function toE164(value: string): string {
  const compact = compactPhone(value);
  return compact.startsWith('+') ? compact : `${INDIA_DIAL_CODE}${digits(compact)}`;
}

const VALIDATORS: FormValidators<OnboardForm> = {
  name: (v) => required(v, 'Hospital name'),
  slug: (v) =>
    required(v, 'Slug') ??
    (SLUG_PATTERN.test(v) ? undefined : 'Use letters, numbers, hyphens or underscores only.'),
  email: (v) => email(v),
  phone: (v) => hospitalPhone(v),
  address: (v) => required(v, 'Address'),
  city: (v) => required(v, 'City'),
  state: (v) => required(v, 'State'),
  pincode: (v) => pincode(v),
  planId: (v) => required(v, 'Plan'),
  commissionPct: (v) => percent(v, 'Commission'),
  feeValue: (v, all) => {
    if (all.feeKind === 'percent') return percent(v, 'Convenience fee');
    const missing = required(v, 'Convenience fee');
    if (missing) return missing;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? undefined : 'Enter an amount of ₹0 or more.';
  },
  numberPrefix: (v) =>
    required(v, 'Number prefix') ??
    (PREFIX_PATTERN.test(v) ? undefined : 'Use up to 12 capital letters or digits.'),
  mrnFormat: (v) => seriesFormat(v, 'MRN format'),
  bookingFormat: (v) => seriesFormat(v, 'Booking format') ?? bookingFormatProblem(v) ?? undefined,
  receiptFormat: (v) => seriesFormat(v, 'Receipt format'),
  adminFirstName: (v) => required(v, "Administrator's first name"),
  adminEmail: (v) => email(v),
  adminPhone: (v) => (v.trim() === '' ? undefined : phoneIN(v)),
};

/**
 * Server keys (`PlatformHospitalCreateRequest`, dotted for nested errors) →
 * form fields, for a 400. Numbering errors come per series
 * (`numbering.booking.prefix`, B4); an older backend sends bare `prefix`.
 */
const SERVER_FIELDS: Readonly<Record<string, FormKey>> = {
  name: 'name',
  slug: 'slug',
  email: 'email',
  phone_e164: 'phone',
  timezone: 'timezone',
  address_line1: 'address',
  city: 'city',
  state: 'state',
  pincode: 'pincode',
  plan_id: 'planId',
  commission_bp: 'commissionPct',
  convenience_fee_value: 'feeValue',
  'numbering.mrn.format': 'mrnFormat',
  'numbering.booking.format': 'bookingFormat',
  'numbering.receipt.format': 'receiptFormat',
  'numbering.mrn.prefix': 'numberPrefix',
  'numbering.booking.prefix': 'numberPrefix',
  'numbering.receipt.prefix': 'numberPrefix',
  prefix: 'numberPrefix',
  'first_admin.email': 'adminEmail',
  'first_admin.first_name': 'adminFirstName',
  'first_admin.last_name': 'adminLastName',
  'first_admin.phone_e164': 'adminPhone',
};

/** Labels for summary lines the form has no field for. */
const SERVER_LABELS: Readonly<Record<string, string>> = {
  numbering: 'Numbering',
  first_admin: 'First administrator',
  format: 'Numbering format',
};

function toInput(v: OnboardForm): HospitalCreateInput {
  const feeKind: ConvenienceFeeKind = v.feeKind === 'percent' ? 'percent' : 'flat';
  const prefix = v.numberPrefix.trim();
  const adminPhone = digits(v.adminPhone);
  return {
    slug: v.slug.trim(),
    name: v.name.trim(),
    email: v.email.trim(),
    phoneE164: toE164(v.phone),
    timezone: v.timezone,
    addressLine1: v.address.trim(),
    city: v.city.trim(),
    state: v.state.trim(),
    pincode: v.pincode.trim(),
    commissionBp: Math.round(Number(v.commissionPct) * BP_PER_PERCENT),
    convenienceFeeKind: feeKind,
    convenienceFeeValue: Math.round(
      Number(v.feeValue) * (feeKind === 'percent' ? BP_PER_PERCENT : PAISE_PER_RUPEE),
    ),
    numbering: {
      mrn: { format: v.mrnFormat.trim(), prefix },
      booking: { format: v.bookingFormat.trim(), prefix },
      receipt: { format: v.receiptFormat.trim(), prefix },
    },
    planId: v.planId,
    billingPeriod: v.billingPeriod === 'yearly' ? 'yearly' : 'monthly',
    firstAdmin: {
      email: v.adminEmail.trim(),
      firstName: v.adminFirstName.trim(),
      lastName: v.adminLastName.trim() || null,
      phoneE164: adminPhone ? `${INDIA_DIAL_CODE}${adminPhone}` : null,
    },
  };
}

const INITIAL: OnboardForm = {
  name: '',
  slug: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  timezone: DEFAULT_HOSPITAL_TIMEZONE,
  planId: '',
  billingPeriod: 'monthly',
  commissionPct: '',
  feeKind: 'flat',
  feeValue: '',
  numberPrefix: '',
  mrnFormat: DEFAULT_FORMATS.mrn,
  bookingFormat: DEFAULT_FORMATS.booking,
  receiptFormat: DEFAULT_FORMATS.receipt,
  adminFirstName: '',
  adminLastName: '',
  adminEmail: '',
  adminPhone: '',
};

interface OnboardHospitalModalProps {
  open: boolean;
  onClose: () => void;
  /** Receives the provisioned hospital, so the caller can open it. */
  onDone: (hospital: PlatformHospital) => void;
}

export function OnboardHospitalModal({ open, onClose, onDone }: OnboardHospitalModalProps) {
  const plansQuery = usePlansQuery();
  const create = useCreateHospitalMutation();
  const [serverErrors, setServerErrors] = useState<Partial<Record<FormKey, string>>>({});
  const [serverSummary, setServerSummary] = useState<readonly string[]>([]);
  /** The slug follows the name until someone edits it directly. */
  const [slugEdited, setSlugEdited] = useState(false);
  const plans = (plansQuery.data ?? []).filter((p) => p.isActive);

  const form = useForm<OnboardForm>({
    initial: INITIAL,
    validate: VALIDATORS,
    onSubmit: async (values) => {
      setServerErrors({});
      setServerSummary([]);
      try {
        const hospital = await create.mutateAsync(toInput(values));
        toast(`${hospital.name} onboarded. Its administrator has been invited.`, 'success');
        onDone(hospital);
      } catch (error) {
        if (!isFailure(error)) {
          toast('Could not onboard the hospital.', 'error');
          return;
        }
        // Every server message reaches its field, or the summary (10·F3, UAT-48).
        const mapped = mapServerErrors<FormKey>(error, {
          fields: SERVER_FIELDS,
          labels: SERVER_LABELS,
        });
        setServerErrors(mapped.fields);
        setServerSummary(mapped.summary);
        toast(mapped.headline, 'error');
      }
    },
  });

  const { values } = form;
  const errorFor = (key: FormKey) => form.errorFor(key) ?? serverErrors[key];
  const set = (key: FormKey, value: string) => {
    form.setField(key, value);
    if (serverErrors[key]) setServerErrors((e) => ({ ...e, [key]: undefined }));
  };
  const setName = (v: string) => {
    set('name', v);
    if (!slugEdited) form.setValues({ slug: slugify(v) });
  };

  /** A plain text field bound to one form key. */
  const text = (
    key: FormKey,
    props: { placeholder?: string; inputMode?: 'email' | 'tel' | 'numeric' | 'decimal' } = {},
  ) => (
    <TextInput
      value={values[key]}
      onChange={(v) => set(key, v)}
      onBlur={() => form.blurField(key)}
      height={FIELD_HEIGHT}
      {...props}
    />
  );

  const planName = plans.find((p) => p.id === values.planId)?.name ?? '';
  const billingPeriod: HospitalBillingPeriod =
    values.billingPeriod === 'yearly' ? 'yearly' : 'monthly';
  const feeKind: ConvenienceFeeKind = values.feeKind === 'percent' ? 'percent' : 'flat';

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="Onboard Hospital"
      width={680}
      onSubmit={form.handleSubmit}
      submitLabel="Onboard Hospital"
      busy={form.submitting}
    >
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-4">
          <SectionTitle>Hospital</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <OpsField label="Hospital Name" required error={errorFor('name')}>
              <TextInput
                value={values.name}
                onChange={setName}
                onBlur={() => form.blurField('name')}
                placeholder="e.g. Sunrise Multispeciality"
                height={FIELD_HEIGHT}
              />
            </OpsField>
            <OpsField
              label="Slug"
              required
              error={errorFor('slug')}
              hint="Unique, used in the hospital's links."
            >
              <TextInput
                value={values.slug}
                onChange={(v) => {
                  setSlugEdited(true);
                  set('slug', v);
                }}
                onBlur={() => form.blurField('slug')}
                height={FIELD_HEIGHT}
              />
            </OpsField>
            <OpsField label="Hospital Email" required error={errorFor('email')}>
              {text('email', { placeholder: 'contact@hospital.in', inputMode: 'email' })}
            </OpsField>
            <OpsField
              label="Hospital Phone"
              required
              error={errorFor('phone')}
              hint="A mobile, or a landline with its code, e.g. +91 484 270 1000."
            >
              {text('phone', { placeholder: '98765 43210 or +91 484 270 1000', inputMode: 'tel' })}
            </OpsField>
          </div>
          <OpsField label="Address" required error={errorFor('address')}>
            {text('address', { placeholder: 'Building, street' })}
          </OpsField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          <OpsField
            label="Time zone"
            error={errorFor('timezone')}
            hint="Hospital-local dates (today, sessions, cut-offs) use this zone. Fixed once live."
          >
            <Select
              value={values.timezone}
              options={HOSPITAL_TIMEZONES}
              onChange={(v) => set('timezone', v)}
              height={FIELD_HEIGHT}
            />
          </OpsField>
        </section>

        <section className="flex flex-col gap-4">
          <SectionTitle>Plan &amp; Fees</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <OpsField
              label="Subscription Plan"
              required
              error={errorFor('planId')}
              hint={plansQuery.isError ? 'Plans could not be loaded.' : undefined}
            >
              <Select
                value={planName}
                options={plans.map((p) => p.name)}
                placeholder={plansQuery.isPending ? 'Loading plans…' : 'Choose a plan'}
                onChange={(name) => set('planId', plans.find((p) => p.name === name)?.id ?? '')}
                height={FIELD_HEIGHT}
              />
            </OpsField>
            <OpsField label="Billing Period">
              <Select
                value={BILLING_PERIOD_LABEL[billingPeriod]}
                options={BILLING_PERIODS.map((p) => BILLING_PERIOD_LABEL[p])}
                onChange={(label) =>
                  set(
                    'billingPeriod',
                    BILLING_PERIODS.find((p) => BILLING_PERIOD_LABEL[p] === label) ?? 'monthly',
                  )
                }
                height={FIELD_HEIGHT}
              />
            </OpsField>
            <OpsField
              label="Commission (%)"
              required
              error={errorFor('commissionPct')}
              hint="Platform share of online booking fees."
            >
              {text('commissionPct', { placeholder: '10', inputMode: 'decimal' })}
            </OpsField>
            <div className="grid grid-cols-2 gap-3">
              <OpsField label="Convenience Fee">
                <Select
                  value={FEE_KIND_LABEL[feeKind]}
                  options={FEE_KINDS.map((k) => FEE_KIND_LABEL[k])}
                  onChange={(label) =>
                    set('feeKind', FEE_KINDS.find((k) => FEE_KIND_LABEL[k] === label) ?? 'flat')
                  }
                  height={FIELD_HEIGHT}
                />
              </OpsField>
              <OpsField label="Amount" required error={errorFor('feeValue')}>
                {text('feeValue', {
                  placeholder: feeKind === 'percent' ? '2' : '20',
                  inputMode: 'decimal',
                })}
              </OpsField>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <SectionTitle>Numbering</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <OpsField
              label="Number Prefix"
              required
              error={errorFor('numberPrefix')}
              hint="Replaces {PREFIX} in every series."
            >
              <TextInput
                value={values.numberPrefix}
                onChange={(v) => set('numberPrefix', v.toUpperCase())}
                onBlur={() => form.blurField('numberPrefix')}
                placeholder="SUN"
                height={FIELD_HEIGHT}
              />
            </OpsField>
            <OpsField label="MRN Format" required error={errorFor('mrnFormat')}>
              {text('mrnFormat')}
            </OpsField>
            <OpsField label="Booking Format" required error={errorFor('bookingFormat')}>
              {text('bookingFormat')}
            </OpsField>
            <OpsField label="Receipt Format" required error={errorFor('receiptFormat')}>
              {text('receiptFormat')}
            </OpsField>
          </div>
          <div className="text-caption text-text-muted">
            Tokens: {'{PREFIX}'} {'{SEQ:n}'} {'{FY}'} {'{YY}'} {'{YYYY}'} {'{MM}'}. The MRN format
            locks once the first patient is registered.
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <SectionTitle>First Administrator</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <OpsField label="First Name" required error={errorFor('adminFirstName')}>
              {text('adminFirstName')}
            </OpsField>
            <OpsField label="Last Name">{text('adminLastName')}</OpsField>
            <OpsField label="Email" required error={errorFor('adminEmail')}>
              {text('adminEmail', { placeholder: 'admin@hospital.in', inputMode: 'email' })}
            </OpsField>
            <OpsField label="Mobile" error={errorFor('adminPhone')}>
              {text('adminPhone', { placeholder: 'Optional', inputMode: 'tel' })}
            </OpsField>
          </div>
        </section>

        <FormErrorSummary messages={serverSummary} />
        <div className="text-caption text-text-muted bg-blue-soft-bg flex items-start gap-2 rounded-sm px-3 py-2.5">
          <Icon name="info" size={14} className="mt-px flex-none" /> The hospital starts in
          onboarding and its administrator is emailed an invitation. Review its documents and take
          it live on Network › Onboarding.
        </div>
      </div>
    </FormModal>
  );
}
