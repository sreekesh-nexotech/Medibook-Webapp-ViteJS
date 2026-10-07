import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { required } from '@/shared/lib/validate';
import { Field } from '@/shared/ui/Field';
import { FormErrorSummary } from '@/shared/ui/FormErrorSummary';
import { FormModal } from '@/shared/ui/FormModal';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import type { Department } from '@/features/doctors/domain/entities/doctors.types';
import { useSaveDepartmentMutation } from '@/features/doctors/application/queries/useDepartmentMutations';

const STATUS_OPTIONS = ['Active', 'Inactive'] as const;

/** Backend `code` rule: letters, digits, dash or underscore (a slug). */
const CODE_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const CODE_MAX_LENGTH = 40;

interface DeptForm {
  name: string;
  /** Empty on a new department = let the server make one from the name (UAT-49). */
  code: string;
  about: string;
  status: (typeof STATUS_OPTIONS)[number];
}

/** Module level so `useForm`'s error memo stays stable. */
const DEPT_VALIDATORS: FormValidators<DeptForm> = {
  name: (v) => required(v, 'Department name'),
  code: (v) => {
    const code = v.trim();
    if (code === '') return undefined;
    if (code.length > CODE_MAX_LENGTH) return `Use at most ${CODE_MAX_LENGTH} characters.`;
    return CODE_PATTERN.test(code)
      ? undefined
      : 'Use lowercase letters, digits, dashes or underscores (e.g. cardiology).';
  },
};

/** Server field → form field (UAT-48). */
const DEPT_SERVER_FIELDS = {
  name: 'name',
  code: 'code',
  description: 'about',
  is_active: 'status',
} as const;

interface DeptModalProps {
  dept: Department | null;
  open: boolean;
  onClose: () => void;
}

/**
 * Add / edit department (design `DeptModal`), saved to the hospital's
 * catalogue. The backend stores a department's name, code, description and
 * active flag; fees and hours belong to each doctor.
 *
 * An edit is sent with the row version it started from (`If-Match`, UAT-06);
 * a rejected save shows the server's reasons on the fields (UAT-48).
 * Mounted with a `key` per department, so the draft is initialised once.
 */
export function DeptModal({ dept, open, onClose }: DeptModalProps) {
  const isNew = dept === null;
  const save = useSaveDepartmentMutation();
  const form = useForm<DeptForm>({
    initial: {
      name: dept?.name ?? '',
      code: dept?.code ?? '',
      about: dept?.description ?? '',
      status: dept && !dept.isActive ? 'Inactive' : 'Active',
    },
    validate: DEPT_VALIDATORS,
    onSubmit: async (values) => {
      const code = values.code.trim();
      // A code is sent only when the user typed (or changed) one.
      const typedCode = isNew ? code !== '' : code !== '' && code !== dept.code;
      try {
        await save.mutateAsync({
          existing: dept ? { id: dept.id, version: dept.version } : undefined,
          input: {
            name: values.name.trim(),
            description: values.about.trim(),
            isActive: values.status === 'Active',
            ...(typedCode && { code }),
          },
        });
        toast(isNew ? 'Department added' : 'Department updated', 'success');
        onClose();
      } catch (error) {
        toast(
          form.applyServerErrors(
            error,
            { fields: DEPT_SERVER_FIELDS },
            'Could not save the department.',
          ),
          'error',
        );
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
        <FormErrorSummary messages={form.serverSummary} />
        <Field label="Department Name" required error={form.errorFor('name')}>
          <TextInput
            value={form.values.name}
            placeholder="e.g. Cardiology"
            onChange={(v) => form.setField('name', v)}
            onBlur={() => form.blurField('name')}
          />
        </Field>
        <Field
          label="Code"
          error={form.errorFor('code')}
          hint={
            isNew
              ? 'Optional. Leave empty and Medibook makes one from the name.'
              : 'Shown in token labels that use {DEPT}. Changing it does not relabel issued tokens.'
          }
        >
          <TextInput
            value={form.values.code}
            placeholder="e.g. cardiology"
            maxLength={CODE_MAX_LENGTH}
            onChange={(v) => form.setField('code', v.toLowerCase())}
            onBlur={() => form.blurField('code')}
          />
        </Field>
        <Field label="About" error={form.errorFor('about')}>
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
          error={form.errorFor('status')}
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
