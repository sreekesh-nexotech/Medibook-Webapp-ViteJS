import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { money } from '@/shared/lib/format';
import { positiveAmount, required } from '@/shared/lib/validate';
import { Field } from '@/shared/ui/Field';
import { FormErrorSummary } from '@/shared/ui/FormErrorSummary';
import { FormModal } from '@/shared/ui/FormModal';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';
import { Toggle } from '@/shared/ui/Toggle';

import type { Department } from '@/features/doctors/domain/entities/doctors.types';
import type {
  PricedService,
  ServiceInput,
  ServiceTaxRate,
} from '@/features/settings/domain/entities/services.entities';
import { chargedServiceRate, priceService } from '@/features/settings/domain/services.pricing';
import {
  catalogueCodeError,
  HOSPITAL_WIDE_LABEL,
  NO_TAX_LABEL,
  taxLabel,
} from '@/features/settings/presentation/components/services.labels';

/** Editable shape — numbers are held as text while the field is being typed. */
interface ServiceForm {
  name: string;
  code: string;
  /** Empty = hospital-wide (`department_id: null`, UAT-25). */
  departmentId: string;
  durationMinutes: string;
  price: string;
  taxRateId: string;
  description: string;
  requiresDoctor: boolean;
  active: boolean;
}

/** A price of ₹0 is allowed — the API takes it (a free check-up). */
function priceError(value: string): string | undefined {
  const raw = value.trim();
  if (raw === '') return 'Price is required.';
  return /^\d+$/.test(raw) ? undefined : 'Price must be whole rupees.';
}

const VALIDATORS: FormValidators<ServiceForm> = {
  name: (v) => required(v, 'Service name'),
  code: (v) => catalogueCodeError(v),
  durationMinutes: (v) => positiveAmount(v, 'Duration'),
  price: priceError,
};

/** Server field → form field (UAT-48). */
const SERVER_FIELDS = {
  name: 'name',
  code: 'code',
  department_id: 'departmentId',
  duration_min: 'durationMinutes',
  price_paise: 'price',
  tax_rate_id: 'taxRateId',
  description: 'description',
} as const;

interface ServiceModalProps {
  open: boolean;
  /** The service being edited, or null to add one. */
  service: PricedService | null;
  /** The hospital's departments (H1). */
  departments: readonly Department[];
  /** Rates a service may be billed with (active, for services or everything). */
  taxOptions: readonly ServiceTaxRate[];
  /** Every rate, to name a service's current rate even after it was switched off. */
  taxRates: readonly ServiceTaxRate[];
  onClose: () => void;
  /** Persist; rejects with the server's failure so its field errors land on the form. */
  onSave: (input: ServiceInput) => Promise<void>;
}

/**
 * Add / edit one priced service (audit HA-04). A service carries its own
 * price and its **own** tax rate — billed only while that rate is switched on
 * (BE-10), so the hint shows exactly what a patient pays.
 *
 * A service may be hospital-wide (no department); editing one keeps it so
 * (UAT-25). The short code is optional — the server makes one from the name
 * unless the admin types their own (UAT-49).
 *
 * Mount it with a `key` that changes per edited service so the form starts
 * from the right values without a state-syncing effect.
 */
export function ServiceModal({
  open,
  service,
  departments,
  taxOptions,
  taxRates,
  onClose,
  onSave,
}: ServiceModalProps) {
  const form = useForm<ServiceForm>({
    initial: {
      name: service?.name ?? '',
      code: '',
      departmentId: service?.departmentId ?? '',
      durationMinutes: String(service?.durationMinutes ?? 15),
      price: service ? String(service.priceRupees) : '',
      taxRateId: service?.taxRateId ?? '',
      description: service?.description ?? '',
      requiresDoctor: service?.requiresDoctor ?? true,
      active: service?.isActive ?? true,
    },
    validate: VALIDATORS,
    onSubmit: async (v) => {
      try {
        await onSave({
          code: v.code.trim(),
          name: v.name.trim(),
          departmentId: v.departmentId || null,
          durationMinutes: Number(v.durationMinutes),
          priceRupees: Number(v.price),
          // Unchanged → not sent, so a since-deactivated rate does not block the save.
          taxRateId:
            service && (v.taxRateId || null) === service.taxRateId
              ? undefined
              : v.taxRateId || null,
          description: v.description.trim(),
          requiresDoctor: v.requiresDoctor,
          isActive: v.active,
        });
        onClose();
      } catch (error) {
        toast(
          form.applyServerErrors(
            error,
            { fields: SERVER_FIELDS, labels: { code: 'Code' } },
            'The service could not be saved.',
          ),
          'error',
        );
      }
    },
  });

  const price = Number(form.values.price);
  const tax = taxRates.find((t) => t.id === form.values.taxRateId) ?? null;
  const charged = chargedServiceRate(tax);
  const priced = priceService(Number.isFinite(price) ? price : 0, charged);
  const deptLabel =
    departments.find((d) => d.id === form.values.departmentId)?.name ?? HOSPITAL_WIDE_LABEL;
  const deptOptions = [HOSPITAL_WIDE_LABEL, ...departments.map((d) => d.name)];
  const taxNames = [NO_TAX_LABEL, ...taxOptions.map(taxLabel)];
  // A service may point at a rate that is no longer offered — keep it visible, honestly.
  const currentTax = tax
    ? charged
      ? taxLabel(tax)
      : `${taxLabel(tax)} — not charged`
    : form.values.taxRateId
      ? 'Removed rate — not charged'
      : NO_TAX_LABEL;
  const taxHint =
    !Number.isFinite(price) || form.values.price.trim() === ''
      ? 'The one tax this service is billed with.'
      : priced.isInclusive
        ? `Patient pays ${money(priced.total)} (includes ${money(priced.tax)} tax).`
        : `Patient pays ${money(priced.total)}${priced.tax ? ` (${money(priced.tax)} tax)` : ' — tax exempt'}.${
            form.values.taxRateId && !charged
              ? ' Its rate is switched off or removed, so it is billed exempt until you pick another.'
              : ''
          }`;

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={service ? 'Edit Service' : 'Add Service'}
      width={560}
      onSubmit={form.handleSubmit}
      submitLabel={service ? 'Save Service' : 'Add Service'}
      busy={form.submitting}
    >
      <div className="flex flex-col gap-4">
        <FormErrorSummary messages={form.serverSummary} />
        <div className="grid grid-cols-3 gap-4">
          <Field label="Service Name" required error={form.errorFor('name')} className="col-span-2">
            <TextInput
              value={form.values.name}
              onChange={(v) => form.setField('name', v)}
              onBlur={() => form.blurField('name')}
              placeholder="e.g. Echocardiogram"
              height={48}
              autoFocus
            />
          </Field>
          <Field
            label="Short code"
            error={form.errorFor('code')}
            hint={
              service
                ? `Now ${service.code}. Leave empty to keep it.`
                : 'Optional — made from the name if left empty.'
            }
          >
            <TextInput
              value={form.values.code}
              onChange={(v) => form.setField('code', v.replace(/\s/g, ''))}
              onBlur={() => form.blurField('code')}
              placeholder={service?.code ?? 'ECHO'}
              maxLength={40}
              height={48}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Department"
            error={form.errorFor('departmentId')}
            hint="Hospital-wide services belong to no single department."
          >
            <Select
              value={deptLabel}
              options={deptOptions}
              onChange={(name) =>
                form.setField('departmentId', departments.find((d) => d.name === name)?.id ?? '')
              }
              height={48}
            />
          </Field>
          <Field
            label="Duration (minutes)"
            required
            error={form.errorFor('durationMinutes')}
            hint="Chair or room time this service consumes."
          >
            <TextInput
              value={form.values.durationMinutes}
              onChange={(v) => form.setField('durationMinutes', v.replace(/[^0-9]/g, ''))}
              onBlur={() => form.blurField('durationMinutes')}
              inputMode="numeric"
              height={48}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Price (₹)"
            required
            error={form.errorFor('price')}
            hint="Whole rupees, before tax. ₹0 for a free service."
          >
            <TextInput
              value={form.values.price}
              onChange={(v) => form.setField('price', v.replace(/[^0-9]/g, ''))}
              onBlur={() => form.blurField('price')}
              inputMode="numeric"
              height={48}
            />
          </Field>
          <Field label="Tax" error={form.errorFor('taxRateId')} hint={taxHint}>
            <Select
              value={currentTax}
              options={taxNames.includes(currentTax) ? taxNames : [currentTax, ...taxNames]}
              onChange={(label) =>
                form.setField(
                  'taxRateId',
                  label === currentTax
                    ? form.values.taxRateId
                    : (taxOptions.find((t) => taxLabel(t) === label)?.id ?? ''),
                )
              }
              height={48}
            />
          </Field>
        </div>
        <Field
          label="Description"
          error={form.errorFor('description')}
          hint="For your staff — shown in the catalogue."
        >
          <textarea
            value={form.values.description}
            onChange={(e) => form.setField('description', e.target.value)}
            placeholder="One or two lines about what the service includes."
            className="rounded-input border-border text-body text-text-strong box-border h-20 w-full resize-none border p-3"
          />
        </Field>
        <div className="border-border-soft flex items-center gap-3 rounded-md border px-3.5 py-3">
          <Toggle
            value={form.values.requiresDoctor}
            onChange={(v) => form.setField('requiresDoctor', v)}
            label="Needs a doctor"
          />
          <div className="flex flex-col">
            <span className="text-body text-text-strong font-medium">Needs a doctor</span>
            <span className="text-caption text-text-muted">
              Booked into a doctor&apos;s slot. Turn off for a standalone test or procedure.
            </span>
          </div>
        </div>
        <div className="border-border-soft flex items-center gap-3 rounded-md border px-3.5 py-3">
          <Toggle
            value={form.values.active}
            onChange={(v) => form.setField('active', v)}
            label="Service is bookable"
          />
          <div className="flex flex-col">
            <span className="text-body text-text-strong font-medium">Bookable</span>
            <span className="text-caption text-text-muted">
              Inactive services keep their price but disappear from booking.
            </span>
          </div>
        </div>
      </div>
    </FormModal>
  );
}
