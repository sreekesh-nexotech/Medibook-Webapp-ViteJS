import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { phoneIN, required } from '@/shared/lib/validate';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';

import type { BranchDraft } from '@/features/settings/application/store/profile.store';
import type { HospitalBranch } from '@/features/settings/application/store/profile.types';

interface BranchForm {
  name: string;
  address: string;
  city: string;
  phone: string;
  /** Comma-joined department names — chips add and remove entries. */
  departments: string;
}

const VALIDATORS: FormValidators<BranchForm> = {
  name: (v) => required(v, 'Branch name'),
  address: (v) => required(v, 'Address'),
  city: (v) => required(v, 'City'),
  phone: (v) => (v.replace(/\D/g, '').length > 10 ? undefined : phoneIN(v)),
  departments: (v) =>
    v.trim() === '' ? 'Pick at least one department that operates here.' : undefined,
};

interface BranchModalProps {
  open: boolean;
  /** The branch being edited, or null to add one. */
  branch: HospitalBranch | null;
  /** Department names from the hospital's master data. */
  departments: readonly string[];
  onClose: () => void;
  onSave: (draft: BranchDraft) => void;
}

function splitList(value: string): readonly string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v !== '');
}

/**
 * Add / edit a branch (audit HA-03). Which departments operate at a branch is
 * part of the record, because that is what decides where a patient can book a
 * given department at all.
 */
export function BranchModal({ open, branch, departments, onClose, onSave }: BranchModalProps) {
  const form = useForm<BranchForm>({
    initial: {
      name: branch?.name ?? '',
      address: branch?.address ?? '',
      city: branch?.city ?? 'Bengaluru',
      phone: branch?.phone ?? '',
      departments: (branch?.departments ?? []).join(', '),
    },
    validate: VALIDATORS,
    onSubmit: (v) => {
      onSave({
        ...(branch ? { id: branch.id } : {}),
        name: v.name.trim(),
        address: v.address.trim(),
        city: v.city.trim(),
        phone: v.phone.trim(),
        departments: splitList(v.departments),
      });
      onClose();
    },
  });

  const picked = splitList(form.values.departments);
  const remaining = departments.filter((d) => !picked.includes(d));

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={branch ? 'Edit Branch' : 'Add Branch'}
      width={600}
      onSubmit={form.handleSubmit}
      submitLabel={branch ? 'Save Branch' : 'Add Branch'}
      busy={form.submitting}
    >
      <div className="flex flex-col gap-4">
        <Field label="Branch Name" required error={form.errorFor('name')}>
          <TextInput
            value={form.values.name}
            onChange={(v) => form.setField('name', v)}
            onBlur={() => form.blurField('name')}
            placeholder="e.g. Apollo Clinic — Koramangala"
            height={48}
            autoFocus
          />
        </Field>
        <Field label="Address" required error={form.errorFor('address')}>
          <TextInput
            value={form.values.address}
            onChange={(v) => form.setField('address', v)}
            onBlur={() => form.blurField('address')}
            placeholder="Street, area, PIN"
            height={48}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="City" required error={form.errorFor('city')}>
            <TextInput
              value={form.values.city}
              onChange={(v) => form.setField('city', v)}
              onBlur={() => form.blurField('city')}
              height={48}
            />
          </Field>
          <Field label="Phone" required error={form.errorFor('phone')}>
            <TextInput
              value={form.values.phone}
              onChange={(v) => form.setField('phone', v)}
              onBlur={() => form.blurField('phone')}
              inputMode="tel"
              autoComplete="tel"
              placeholder="08045678900"
              height={48}
            />
          </Field>
        </div>
        <Field
          label="Departments operating here"
          required
          error={form.errorFor('departments')}
          hint="Patients can only book these departments at this branch."
        >
          <Select
            value=""
            options={remaining}
            onChange={(v) => form.setField('departments', [...picked, v].join(', '))}
            placeholder={remaining.length === 0 ? 'All departments added' : 'Add a department…'}
            disabled={remaining.length === 0}
            height={48}
          />
        </Field>
        {picked.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {picked.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() =>
                  form.setField('departments', picked.filter((x) => x !== d).join(', '))
                }
                aria-label={`Remove ${d}`}
                className="text-caption bg-blue-soft-bg text-blue inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5"
              >
                {d} <Icon name="x" size={12} />
              </button>
            ))}
          </div>
        )}
      </div>
    </FormModal>
  );
}
