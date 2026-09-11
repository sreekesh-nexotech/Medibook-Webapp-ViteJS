import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { dateRange, required } from '@/shared/lib/validate';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';

import type { HolidayDraft } from '@/features/settings/application/store/profile.store';
import { datesOf } from '@/features/settings/application/store/profile.logic';
import {
  HOLIDAY_SCOPES,
  type HolidayScope,
  type HospitalBranch,
  type HospitalHoliday,
} from '@/features/settings/application/store/profile.types';

const DATE_INPUT_CLASS =
  'rounded-input border-border text-body text-text-body h-12 w-full border bg-white px-3';

interface HolidayForm {
  name: string;
  from: string;
  to: string;
  scope: HolidayScope;
  scopeRef: string;
  note: string;
}

const VALIDATORS: FormValidators<HolidayForm> = {
  name: (v) => required(v, 'Closure name'),
  from: (v) => required(v, 'Start date'),
  to: (v, values) => dateRange(values.from, v),
  scopeRef: (v, values) =>
    values.scope === 'Whole hospital' || v.trim() !== ''
      ? undefined
      : values.scope === 'Branch'
        ? 'Pick the branch that is closed.'
        : 'Pick the department that is closed.',
};

interface HolidayModalProps {
  open: boolean;
  /** The closure being edited, or null to add one. */
  holiday: HospitalHoliday | null;
  branches: readonly HospitalBranch[];
  departments: readonly string[];
  onClose: () => void;
  onSave: (draft: HolidayDraft) => void;
}

/**
 * Add / edit a closure in the holiday calendar (audit HA-03). This calendar is
 * what slot generation reads, so the modal states that consequence plainly and
 * shows how many days the closure will remove.
 */
export function HolidayModal({
  open,
  holiday,
  branches,
  departments,
  onClose,
  onSave,
}: HolidayModalProps) {
  const form = useForm<HolidayForm>({
    initial: {
      name: holiday?.name ?? '',
      from: holiday?.from ?? '',
      to: holiday?.to ?? '',
      scope: holiday?.scope ?? 'Whole hospital',
      scopeRef: holiday?.scopeRef ?? '',
      note: holiday?.note ?? '',
    },
    validate: VALIDATORS,
    onSubmit: (v) => {
      onSave({
        ...(holiday ? { id: holiday.id } : {}),
        name: v.name.trim(),
        from: v.from,
        to: v.to || v.from,
        scope: v.scope,
        scopeRef: v.scope === 'Whole hospital' ? '' : v.scopeRef,
        note: v.note.trim(),
      });
      onClose();
    },
  });

  const dayCount =
    form.values.from && form.values.to && form.values.to >= form.values.from
      ? datesOf({
          id: 'preview',
          name: '',
          from: form.values.from,
          to: form.values.to,
          scope: form.values.scope,
          scopeRef: form.values.scopeRef,
          note: '',
        }).length
      : 0;

  const scopeOptions =
    form.values.scope === 'Branch' ? branches.map((b) => b.name) : [...departments];

  const scopeValue =
    form.values.scope === 'Branch'
      ? (branches.find((b) => b.id === form.values.scopeRef)?.name ?? '')
      : form.values.scopeRef;

  const onScopeRef = (label: string): void => {
    if (form.values.scope === 'Branch') {
      form.setField('scopeRef', branches.find((b) => b.name === label)?.id ?? '');
      return;
    }
    form.setField('scopeRef', label);
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={holiday ? 'Edit Closure' : 'Add Closure'}
      width={600}
      onSubmit={form.handleSubmit}
      submitLabel={holiday ? 'Save Closure' : 'Add Closure'}
      busy={form.submitting}
    >
      <div className="flex flex-col gap-4">
        <Field label="Closure Name" required error={form.errorFor('name')}>
          <TextInput
            value={form.values.name}
            onChange={(v) => form.setField('name', v)}
            onBlur={() => form.blurField('name')}
            placeholder="e.g. Independence Day"
            height={48}
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="From" required error={form.errorFor('from')}>
            <input
              type="date"
              value={form.values.from}
              onChange={(e) => {
                form.setField('from', e.target.value);
                // A single-day closure is the common case: keep `to` in step
                // until the user deliberately extends it.
                if (!form.values.to || form.values.to < e.target.value) {
                  form.setField('to', e.target.value);
                }
              }}
              onBlur={() => form.blurField('from')}
              aria-label="Closure start date"
              className={DATE_INPUT_CLASS}
            />
          </Field>
          <Field
            label="To"
            required
            error={form.errorFor('to')}
            hint="Same day for a single-day closure."
          >
            <input
              type="date"
              value={form.values.to}
              onChange={(e) => form.setField('to', e.target.value)}
              onBlur={() => form.blurField('to')}
              aria-label="Closure end date"
              className={DATE_INPUT_CLASS}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Applies to">
            <Select
              value={form.values.scope}
              options={HOLIDAY_SCOPES}
              onChange={(v) => {
                form.setField('scope', v as HolidayScope);
                form.setField('scopeRef', '');
              }}
              height={48}
            />
          </Field>
          {form.values.scope !== 'Whole hospital' && (
            <Field
              label={form.values.scope === 'Branch' ? 'Branch' : 'Department'}
              required
              error={form.errorFor('scopeRef')}
            >
              <Select
                value={scopeValue}
                options={scopeOptions}
                onChange={onScopeRef}
                onBlur={() => form.blurField('scopeRef')}
                placeholder={
                  form.values.scope === 'Branch' ? 'Select a branch' : 'Select a department'
                }
                height={48}
              />
            </Field>
          )}
        </div>
        <Field label="Note" hint="Shown to staff on the slot grid and in the patient app.">
          <TextInput
            value={form.values.note}
            onChange={(v) => form.setField('note', v)}
            placeholder="e.g. Emergency care only."
            height={48}
          />
        </Field>
        <div className="text-body text-y-800 bg-y-100 flex items-start gap-2 rounded-md px-3.5 py-3">
          <Icon name="calendar-x" size={16} className="mt-0.5 flex-none" />
          <span>
            {dayCount > 0
              ? `No slots will be generated for ${dayCount} ${dayCount === 1 ? 'day' : 'days'} — ${
                  form.values.scope === 'Whole hospital'
                    ? 'across the whole hospital'
                    : form.values.scope === 'Branch'
                      ? `at ${scopeValue || 'the selected branch'}`
                      : `for ${scopeValue || 'the selected department'}`
                }. Existing appointments on those days must be rescheduled.`
              : 'Pick a date range to see how many days this closure removes from booking.'}
          </span>
        </div>
      </div>
    </FormModal>
  );
}
