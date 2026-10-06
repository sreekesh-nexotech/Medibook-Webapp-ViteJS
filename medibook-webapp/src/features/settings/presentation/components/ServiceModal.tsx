import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { money } from '@/shared/lib/format';
import { positiveAmount, required } from '@/shared/lib/validate';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { Toggle } from '@/shared/ui/Toggle';

import type { Department } from '@/features/doctors/domain/entities/doctors.types';
import type {
  PricedService,
  ServiceInput,
  ServiceTaxRate,
} from '@/features/settings/domain/entities/services.entities';
import { priceService } from '@/features/settings/domain/services.pricing';
import {
  NO_TAX_LABEL,
  taxLabel,
} from '@/features/settings/presentation/components/services.labels';

/** Editable shape — numbers are held as text while the field is being typed. */
interface ServiceForm {
  name: string;
  departmentId: string;
  durationMinutes: string;
  price: string;
  taxRateId: string;
  description: string;
  requiresDoctor: boolean;
  active: boolean;
}

const VALIDATORS: FormValidators<ServiceForm> = {
  name: (v) => required(v, 'Service name'),
  departmentId: (v) => required(v, 'Department'),
  durationMinutes: (v) => positiveAmount(v, 'Duration'),
  price: (v) => positiveAmount(v, 'Price'),
};

interface ServiceModalProps {
  open: boolean;
  /** The service being edited, or null to add one. */
  service: PricedService | null;
  /** The hospital's departments (H1). */
  departments: readonly Department[];
  /** Rates a service may be billed with (active, for services or everything). */
  taxOptions: readonly ServiceTaxRate[];
  /** Every rate, to price a service still linked to one that was switched off. */
  taxRates: readonly ServiceTaxRate[];
  onClose: () => void;
  /** Persist; resolves `true` when saved (the caller reports failures). */
  onSave: (input: ServiceInput) => Promise<boolean>;
}

/**
 * Add / edit one priced service (audit HA-04). A service carries its own
 * price and its **own** tax rate — the backend bills a service with that one
 * rate (none = exempt), so the hint shows exactly what a patient pays.
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
      departmentId: service?.departmentId ?? departments[0]?.id ?? '',
      durationMinutes: String(service?.durationMinutes ?? 15),
      price: service ? String(service.priceRupees) : '',
      taxRateId: service?.taxRateId ?? '',
      description: service?.description ?? '',
      requiresDoctor: service?.requiresDoctor ?? true,
      active: service?.isActive ?? true,
    },
    validate: VALIDATORS,
    onSubmit: async (v) => {
      const saved = await onSave({
        name: v.name.trim(),
        departmentId: v.departmentId || null,
        durationMinutes: Number(v.durationMinutes),
        priceRupees: Number(v.price),
        // Unchanged → not sent, so a since-deactivated rate does not block the save.
        taxRateId:
          service && (v.taxRateId || null) === service.taxRateId ? undefined : v.taxRateId || null,
        description: v.description.trim(),
        requiresDoctor: v.requiresDoctor,
        isActive: v.active,
      });
      if (saved) onClose();
    },
  });

  const price = Number(form.values.price);
  const tax = taxRates.find((t) => t.id === form.values.taxRateId) ?? null;
  const taxSwitchedOff = tax !== null && !tax.isActive;
  const priced = priceService(Number.isFinite(price) ? price : 0, tax);
  const deptName = departments.find((d) => d.id === form.values.departmentId)?.name ?? '';
  const taxNames = [NO_TAX_LABEL, ...taxOptions.map(taxLabel)];
  // A service may point at a rate that is no longer offered (inactive) — keep it visible.
  const currentTax = tax
    ? taxSwitchedOff
      ? `${taxLabel(tax)} — switched off`
      : taxLabel(tax)
    : form.values.taxRateId
      ? 'Current rate (unknown)'
      : NO_TAX_LABEL;

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
        <Field label="Service Name" required error={form.errorFor('name')}>
          <TextInput
            value={form.values.name}
            onChange={(v) => form.setField('name', v)}
            onBlur={() => form.blurField('name')}
            placeholder="e.g. Echocardiogram"
            height={48}
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Department"
            required
            error={form.errorFor('departmentId')}
            hint={
              departments.length === 0
                ? 'Add a department in Doctors & Departments first.'
                : undefined
            }
          >
            <Select
              value={deptName}
              options={departments.map((d) => d.name)}
              onChange={(name) =>
                form.setField('departmentId', departments.find((d) => d.name === name)?.id ?? '')
              }
              placeholder="Select a department"
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
            hint="Whole rupees, before tax."
          >
            <TextInput
              value={form.values.price}
              onChange={(v) => form.setField('price', v.replace(/[^0-9]/g, ''))}
              onBlur={() => form.blurField('price')}
              inputMode="numeric"
              height={48}
            />
          </Field>
          <Field
            label="Tax"
            hint={
              Number.isFinite(price) && price > 0
                ? priced.isInclusive
                  ? `Patient pays ${money(priced.total)} (includes ${money(priced.tax)} tax).`
                  : `Patient pays ${money(priced.total)}${priced.tax ? ` (${money(priced.tax)} tax)` : ''}.${
                      taxSwitchedOff
                        ? ' This rate is switched off but is still charged on this service until you pick another.'
                        : ''
                    }`
                : 'The one tax this service is billed with.'
            }
          >
            <Select
              value={currentTax}
              options={taxNames.includes(currentTax) ? taxNames : [currentTax, ...taxNames]}
              onChange={(label) =>
                form.setField('taxRateId', taxOptions.find((t) => taxLabel(t) === label)?.id ?? '')
              }
              height={48}
            />
          </Field>
        </div>
        <Field label="Description" hint="Shown to patients in the Medibook app.">
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
