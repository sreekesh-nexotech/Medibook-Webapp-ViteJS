import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { required } from '@/shared/lib/validate';
import { Field } from '@/shared/ui/Field';
import { FormErrorSummary } from '@/shared/ui/FormErrorSummary';
import { FormModal } from '@/shared/ui/FormModal';
import { TextInput } from '@/shared/ui/TextInput';
import { Toggle } from '@/shared/ui/Toggle';
import { toast } from '@/shared/ui/toast/toast.store';

import type { Counter } from '@/features/settings/domain/entities/settings.entities';
import { useSaveCounterMutation } from '@/features/settings/application/queries/useCounterMutations';

/** `HospitalCounterSerializer.code`: a letter or digit, then up to 15 of letters, digits, _ or -. */
const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,15}$/;
const CODE_MAX = 16;
const NAME_MAX = 100;

interface CounterForm {
  code: string;
  name: string;
  isActive: boolean;
}

const VALIDATORS: FormValidators<CounterForm> = {
  code: (v) => {
    if (v.trim() === '') return 'Counter code is required.';
    return CODE_PATTERN.test(v.trim())
      ? undefined
      : 'Up to 16 letters, digits, dashes or underscores (e.g. C1).';
  },
  name: (v) => required(v, 'Counter name'),
};

const SERVER_FIELDS = { code: 'code', name: 'name', is_active: 'isActive' } as const;

interface CounterModalProps {
  counter: Counter | null;
  onClose: () => void;
}

/** Add or edit a front-desk counter; its code prints on every receipt it takes. */
export function CounterModal({ counter, onClose }: CounterModalProps) {
  const save = useSaveCounterMutation();
  const form = useForm<CounterForm>({
    initial: {
      code: counter?.code ?? '',
      name: counter?.name ?? '',
      isActive: counter?.isActive ?? true,
    },
    validate: VALIDATORS,
    onSubmit: async (v) => {
      try {
        await save.mutateAsync({
          existing: counter ? { id: counter.id, version: counter.version } : undefined,
          input: { code: v.code.trim(), name: v.name.trim(), isActive: v.isActive },
        });
        toast(counter ? 'Counter saved' : 'Counter added', 'success');
        onClose();
      } catch (error) {
        toast(
          form.applyServerErrors(
            error,
            { fields: SERVER_FIELDS },
            'The counter could not be saved.',
          ),
          'error',
        );
      }
    },
  });
  return (
    <FormModal
      open
      onClose={onClose}
      title={counter ? 'Edit Counter' : 'Add Counter'}
      width={520}
      onSubmit={form.handleSubmit}
      submitLabel={counter ? 'Save' : 'Add Counter'}
      busy={form.submitting}
    >
      <div className="flex flex-col gap-4.5">
        <FormErrorSummary messages={form.serverSummary} />
        <div className="grid grid-cols-3 gap-4">
          <Field label="Code" required error={form.errorFor('code')} hint="Printed on receipts.">
            <TextInput
              value={form.values.code}
              onChange={(v) => form.setField('code', v.toUpperCase())}
              onBlur={() => form.blurField('code')}
              maxLength={CODE_MAX}
              placeholder="C1"
            />
          </Field>
          <Field label="Name" required error={form.errorFor('name')} className="col-span-2">
            <TextInput
              value={form.values.name}
              onChange={(v) => form.setField('name', v)}
              onBlur={() => form.blurField('name')}
              maxLength={NAME_MAX}
              placeholder="e.g. Main Reception"
            />
          </Field>
        </div>
        <div className="border-border-soft flex items-center justify-between rounded-md border px-3.5 py-3">
          <span className="text-body text-text-body" id="counter-active-label">
            In use
            <span className="text-caption text-text-muted block">
              Inactive counters cannot be picked for a cash drawer or as a default.
            </span>
          </span>
          <Toggle
            value={form.values.isActive}
            onChange={(v) => form.setField('isActive', v)}
            aria-labelledby="counter-active-label"
          />
        </div>
      </div>
    </FormModal>
  );
}
