import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { money } from '@/shared/lib/format';
import { positiveAmount, required } from '@/shared/lib/validate';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { Toggle } from '@/shared/ui/Toggle';

import type { ServiceDraft } from '@/features/settings/application/store/services.store';
import type { HospitalService } from '@/features/settings/application/store/services.types';

/** Editable shape — numbers are held as text while the field is being typed. */
interface ServiceForm {
  name: string;
  dept: string;
  durationMinutes: string;
  price: string;
  description: string;
  active: boolean;
}

const VALIDATORS: FormValidators<ServiceForm> = {
  name: (v) => required(v, 'Service name'),
  dept: (v) => required(v, 'Department'),
  durationMinutes: (v) => positiveAmount(v, 'Duration'),
  price: (v) => positiveAmount(v, 'Price'),
};

interface ServiceModalProps {
  open: boolean;
  /** The service being edited, or null to add one. */
  service: HospitalService | null;
  /** Department names from the hospital's master data. */
  departments: readonly string[];
  onClose: () => void;
  onSave: (draft: ServiceDraft) => void;
}

/**
 * Add / edit one priced service (audit HA-04). The price lives here, not on
 * the department, which is the whole point: a department's base fee is the
 * consultation, a service carries its own price.
 *
 * Mount it with a `key` that changes per edited service so the form starts
 * from the right values without a state-syncing effect.
 */
export function ServiceModal({ open, service, departments, onClose, onSave }: ServiceModalProps) {
  const form = useForm<ServiceForm>({
    initial: {
      name: service?.name ?? '',
      dept: service?.dept ?? departments[0] ?? '',
      durationMinutes: String(service?.durationMinutes ?? 15),
      price: String(service?.price ?? ''),
      description: service?.description ?? '',
      active: service?.active ?? true,
    },
    validate: VALIDATORS,
    onSubmit: (v) => {
      onSave({
        ...(service ? { id: service.id } : {}),
        name: v.name.trim(),
        dept: v.dept,
        durationMinutes: Number(v.durationMinutes),
        price: Number(v.price),
        description: v.description.trim(),
        active: v.active,
      });
      onClose();
    },
  });

  const price = Number(form.values.price);

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
          <Field label="Department" required error={form.errorFor('dept')}>
            <Select
              value={form.values.dept}
              options={departments}
              onChange={(v) => form.setField('dept', v)}
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
        <Field
          label="Price (₹)"
          required
          error={form.errorFor('price')}
          hint={
            Number.isFinite(price) && price > 0
              ? `${money(price)} before tax — independent of the department base fee.`
              : 'Whole rupees, before tax.'
          }
        >
          <TextInput
            value={form.values.price}
            onChange={(v) => form.setField('price', v.replace(/[^0-9]/g, ''))}
            onBlur={() => form.blurField('price')}
            inputMode="numeric"
            height={48}
          />
        </Field>
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
