import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { required } from '@/shared/lib/validate';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import { isFailure } from '@/core/error/failure';

import type { Department } from '@/features/doctors/domain/entities/doctors.types';
import { useSaveDepartmentMutation } from '@/features/doctors/application/queries/useDepartmentMutations';

const STATUS_OPTIONS = ['Active', 'Inactive'] as const;

interface DeptForm {
  name: string;
  about: string;
  status: (typeof STATUS_OPTIONS)[number];
}

/** Module level so `useForm`'s error memo stays stable. */
const DEPT_VALIDATORS: FormValidators<DeptForm> = {
  name: (v) => required(v, 'Department name'),
};

interface DeptModalProps {
  dept: Department | null;
  open: boolean;
  onClose: () => void;
}

/**
 * Add / edit department (design `DeptModal`), saved to the hospital's
 * catalogue. The backend stores a department's name, description and active
 * flag; fees and hours belong to each doctor, so the design's base fee,
 * weekly hours and cover image are not offered here.
 *
 * Mounted with a `key` per department, so the draft is initialised once.
 */
export function DeptModal({ dept, open, onClose }: DeptModalProps) {
  const isNew = dept === null;
  const save = useSaveDepartmentMutation();
  const form = useForm<DeptForm>({
    initial: {
      name: dept?.name ?? '',
      about: dept?.description ?? '',
      status: dept && !dept.isActive ? 'Inactive' : 'Active',
    },
    validate: DEPT_VALIDATORS,
    onSubmit: async (values) => {
      try {
        await save.mutateAsync({
          id: dept?.id,
          input: {
            name: values.name.trim(),
            description: values.about.trim(),
            isActive: values.status === 'Active',
          },
        });
        toast(isNew ? 'Department added' : 'Department updated', 'success');
        onClose();
      } catch (error) {
        toast(isFailure(error) ? error.message : 'Could not save the department.', 'error');
      }
    },
  });

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={isNew ? 'Add Department' : 'Edit Department'}
      width={560}
      onSubmit={form.handleSubmit}
      submitLabel={isNew ? 'Add Department' : 'Save'}
      busy={form.submitting}
    >
      <div className="flex flex-col gap-4.5">
        <Field label="Department Name" required error={form.errorFor('name')}>
          <TextInput
            value={form.values.name}
            placeholder="e.g. Cardiology"
            onChange={(v) => form.setField('name', v)}
            onBlur={() => form.blurField('name')}
          />
        </Field>
        <Field label="About">
          {(field) => (
            <textarea
              id={field.id}
              value={form.values.about}
              placeholder="Short description shown in the patient app"
              onChange={(e) => form.setField('about', e.target.value)}
              className="border-border text-body-lg text-text-strong rounded-input box-border h-18.5 w-full resize-none border p-3"
            />
          )}
        </Field>
        <Field
          label="Status"
          hint="Inactive departments are hidden from the patient app; their doctors stay."
        >
          <Select
            value={form.values.status}
            options={STATUS_OPTIONS}
            onChange={(v) => form.setField('status', v === 'Inactive' ? 'Inactive' : 'Active')}
          />
        </Field>
      </div>
    </FormModal>
  );
}
