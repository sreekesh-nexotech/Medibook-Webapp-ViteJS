import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { dateRange, required } from '@/shared/lib/validate';
import { Field } from '@/shared/ui/Field';
import { FormErrorSummary } from '@/shared/ui/FormErrorSummary';
import { FormModal } from '@/shared/ui/FormModal';
import { toast } from '@/shared/ui/toast/toast.store';
import { Icon } from '@/shared/ui/Icon';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';

import type { Holiday, HolidayInput } from '@/features/settings/domain/entities/profile.entities';
import {
  HOLIDAY_SCOPE_OPTIONS,
  type HolidayScopeOption,
  holidayDayCount,
  holidayScopeOf,
} from '@/features/settings/application/store/profile.form';

const DATE_INPUT_CLASS =
  'rounded-input border-border text-body text-text-body h-12 w-full border bg-white px-3';

interface HolidayForm {
  name: string;
  from: string;
  to: string;
  scope: HolidayScopeOption;
  departmentId: string;
  note: string;
}

const VALIDATORS: FormValidators<HolidayForm> = {
  name: (v) => required(v, 'Closure name'),
  from: (v) => required(v, 'Start date'),
  to: (v, values) => dateRange(values.from, v),
  departmentId: (v, values) =>
    values.scope === 'Whole hospital' || v.trim() !== ''
      ? undefined
      : 'Pick the department that is closed.',
};

/** A department as the scope picker lists it. */
export interface HolidayDepartmentOption {
  readonly id: string;
  readonly name: string;
}

/** What saving did: done (applied, or handed to the impact confirmation), or failed with why. */
export type HolidaySaveOutcome =
  { readonly status: 'done' } | { readonly status: 'failed'; readonly error: unknown };

/** Server field → form field (UAT-48). */
const HOLIDAY_SERVER_FIELDS = {
  name: 'name',
  date_from: 'from',
  date_to: 'to',
  department_id: 'departmentId',
  note: 'note',
} as const;

interface HolidayModalProps {
  open: boolean;
  /** The closure being edited, or null to add one. */
  holiday: Holiday | null;
  departments: readonly HolidayDepartmentOption[];
  onClose: () => void;
  /**
   * Save the closure. `done` closes the modal (applied, or handed to the
   * screen's impact confirmation); `failed` keeps it open with the server's
   * reasons on the fields.
   */
  onSave: (input: HolidayInput) => Promise<HolidaySaveOutcome>;
}

/**
 * Add / edit a closure in the holiday calendar (audit HA-03). This calendar is
 * what slot generation reads, so the modal states that consequence plainly and
 * shows how many days the closure will remove. The backend checks which
 * bookings it would cancel before anything is applied.
 */
export function HolidayModal({ open, holiday, departments, onClose, onSave }: HolidayModalProps) {
  const form = useForm<HolidayForm>({
    initial: {
      name: holiday?.name ?? '',
      from: holiday?.from ?? '',
      to: holiday?.to ?? '',
      scope: holiday ? holidayScopeOf(holiday) : 'Whole hospital',
      departmentId: holiday?.departmentId ?? '',
      note: holiday?.note ?? '',
    },
    validate: VALIDATORS,
    onSubmit: async (v) => {
      const note = v.note.trim();
      const outcome = await onSave({
        name: v.name.trim(),
        from: v.from,
        to: v.to || v.from,
        departmentId: v.scope === 'Whole hospital' ? null : v.departmentId,
        note: note === '' ? null : note,
      });
      if (outcome.status === 'done') {
        onClose();
        return;
      }
      toast(
        form.applyServerErrors(
          outcome.error,
          { fields: HOLIDAY_SERVER_FIELDS },
          'The closure could not be saved.',
        ),
        'error',
      );
    },
  });

  const dayCount = holidayDayCount(form.values.from, form.values.to);
  const departmentName = departments.find((d) => d.id === form.values.departmentId)?.name ?? '';

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
        <FormErrorSummary messages={form.serverSummary} />
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
              options={HOLIDAY_SCOPE_OPTIONS}
              onChange={(v) => {
                form.setField('scope', v === 'Department' ? 'Department' : 'Whole hospital');
                form.setField('departmentId', '');
              }}
              height={48}
            />
          </Field>
          {form.values.scope === 'Department' && (
            <Field label="Department" required error={form.errorFor('departmentId')}>
              <Select
                value={departmentName}
                options={departments.map((d) => d.name)}
                onChange={(name) =>
                  form.setField('departmentId', departments.find((d) => d.name === name)?.id ?? '')
                }
                onBlur={() => form.blurField('departmentId')}
                placeholder={departments.length > 0 ? 'Select a department' : 'No departments yet'}
                height={48}
              />
            </Field>
          )}
        </div>
        <Field
          label="Note"
          error={form.errorFor('note')}
          hint="Shown to staff on the holiday calendar and the slot grid."
        >
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
                    : `for ${departmentName || 'the selected department'}`
                }. Before anything is saved you will see any booked appointments it would cancel (with a full refund).`
              : 'Pick a date range to see how many days this closure removes from booking.'}
          </span>
        </div>
      </div>
    </FormModal>
  );
}
