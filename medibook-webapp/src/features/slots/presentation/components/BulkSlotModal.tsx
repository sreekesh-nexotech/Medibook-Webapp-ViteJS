import { useMemo, useState } from 'react';

import { TIME_OPTS } from '@/features/doctors/application/store/catalog.fixtures';
import {
  addIsoDays,
  formatIsoDayLabel,
  isoWeekdayLabel,
  timeLabelToMinutes,
} from '@/features/doctors/domain/calendar';
import { useSlotGrids } from '@/features/slots/application/store/slots.selectors';
import { useSlotsStore } from '@/features/slots/application/store/slots.store';
import type { SlotRef, SlotState } from '@/features/slots/domain/slot';
import { collectSlotRefs } from '@/features/slots/domain/slot-grid';
import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { Select } from '@/shared/ui/Select';
import { toast } from '@/shared/ui/toast/toast.store';

/** What a bulk update covers. */
type BulkScope = 'all-doctors' | 'one-doctor' | 'weekday';

/** Repeat horizon for the weekday scope — no hospital setting defines one. */
const WEEK_OPTIONS = ['2 weeks', '4 weeks', '8 weeks'] as const;
const DEFAULT_WEEKS = '4 weeks';
const DAYS_PER_WEEK = 7;

type BulkAction = 'Block' | 'Open';

const ACTION_OPTIONS: readonly BulkAction[] = ['Block', 'Open'];

/** The states each action can legally move a slot out of. */
const ACTION_SOURCE_STATES: Readonly<Record<BulkAction, readonly SlotState[]>> = {
  Block: ['available'],
  Open: ['blocked'],
};

interface BulkForm {
  scopeLabel: string;
  doctorId: string;
  action: BulkAction;
  from: string;
  to: string;
  weeks: string;
}

const BULK_VALIDATORS: FormValidators<BulkForm> = {
  to: (v, values) => {
    const from = timeLabelToMinutes(values.from);
    const to = timeLabelToMinutes(v);
    if (from == null || to == null) return 'Pick a start and an end time.';
    return to >= from ? undefined : 'The end of the range must be at or after its start.';
  },
};

export interface BulkSlotDoctor {
  readonly id: string;
  readonly name: string;
}

interface BulkSlotModalProps {
  /** The date the grid is showing. */
  date: string;
  /** Department filter in force on the screen, so the count matches the view. */
  dept: string | null;
  /** Pre-selected doctor when the modal is opened from a grid row. */
  initialDoctorId?: string | null;
  doctors: readonly BulkSlotDoctor[];
  onClose: () => void;
}

/**
 * Bulk open / block (audit HA-08: "no bulk update").
 *
 * Three scopes — the whole date, one doctor on that date, or that weekday for
 * one doctor over the next few weeks — narrowed by a time range. The count in
 * the hint and in the confirmation is the **real** number of slots collected
 * from the generated grids, and booked or past slots are never included, so a
 * bulk block cannot quietly sit on top of somebody's appointment.
 */
export function BulkSlotModal({
  date,
  dept,
  initialDoctorId,
  doctors,
  onClose,
}: BulkSlotModalProps) {
  const blockSlots = useSlotsStore((s) => s.blockSlots);
  const openSlots = useSlotsStore((s) => s.openSlots);
  // A boolean, not the collected refs: the refs are derived from the form's
  // own values, so storing them here would make the form's type circular.
  const [confirming, setConfirming] = useState(false);

  const weekday = isoWeekdayLabel(date);
  const scopeLabels = useMemo<Readonly<Record<BulkScope, string>>>(
    () => ({
      'all-doctors': 'This date — every doctor',
      'one-doctor': 'This date — one doctor',
      weekday: `Every ${weekday} — one doctor`,
    }),
    [weekday],
  );
  const scopeOf = (label: string): BulkScope =>
    (Object.keys(scopeLabels) as BulkScope[]).find((k) => scopeLabels[k] === label) ??
    'all-doctors';

  const form = useForm<BulkForm>({
    initial: {
      scopeLabel: initialDoctorId ? scopeLabels['one-doctor'] : scopeLabels['all-doctors'],
      doctorId: initialDoctorId ?? doctors[0]?.id ?? '',
      action: 'Block',
      from: TIME_OPTS[0],
      to: TIME_OPTS[TIME_OPTS.length - 1],
      weeks: DEFAULT_WEEKS,
    },
    validate: BULK_VALIDATORS,
    onSubmit: () => setConfirming(true),
  });

  const { values } = form;
  const scope = scopeOf(values.scopeLabel);
  const oneDoctor = scope !== 'all-doctors';
  const weekCount = Number(values.weeks.split(' ')[0]) || 1;

  const dates = useMemo(
    () =>
      scope === 'weekday'
        ? Array.from({ length: weekCount }, (_, i) => addIsoDays(date, i * DAYS_PER_WEEK))
        : [date],
    [scope, weekCount, date],
  );

  const grids = useSlotGrids(dates, {
    dept,
    doctorId: oneDoctor ? values.doctorId : null,
  });

  const refs = useMemo<readonly SlotRef[]>(() => {
    const fromMinutes = timeLabelToMinutes(values.from);
    const toMinutes = timeLabelToMinutes(values.to);
    if (fromMinutes == null || toMinutes == null || toMinutes < fromMinutes) return [];
    return grids.flatMap((result) =>
      result.ok
        ? collectSlotRefs(result.grid, {
            doctorId: oneDoctor ? values.doctorId : null,
            fromMinutes,
            toMinutes,
            states: ACTION_SOURCE_STATES[values.action],
          })
        : [],
    );
  }, [grids, values.from, values.to, values.action, values.doctorId, oneDoctor]);

  const doctorName = doctors.find((d) => d.id === values.doctorId)?.name ?? 'this doctor';
  const scopeCopy =
    scope === 'all-doctors'
      ? `every doctor on ${formatIsoDayLabel(date)}`
      : scope === 'one-doctor'
        ? `${doctorName} on ${formatIsoDayLabel(date)}`
        : `${doctorName} on every ${weekday} for ${weekCount} week${weekCount === 1 ? '' : 's'}`;

  const apply = (): void => {
    if (refs.length === 0) return;
    if (values.action === 'Block') blockSlots(refs);
    else openSlots(refs);
    toast(
      `${refs.length} slot${refs.length === 1 ? '' : 's'} ${
        values.action === 'Block' ? 'blocked' : 'opened'
      }`,
      'success',
    );
    setConfirming(false);
    onClose();
  };

  return (
    <>
      <FormModal
        open={!confirming}
        onClose={onClose}
        title="Bulk Update Slots"
        width={600}
        onSubmit={form.handleSubmit}
        submitLabel={
          refs.length === 0
            ? `${values.action} slots`
            : `${values.action} ${refs.length} slot${refs.length === 1 ? '' : 's'}`
        }
        submitVariant={values.action === 'Block' ? 'danger' : 'primary'}
        disabled={refs.length === 0}
      >
        <div className="flex flex-col gap-4.5">
          <Field label="Apply to" required>
            <Select
              value={values.scopeLabel}
              options={Object.values(scopeLabels)}
              onChange={(v) => form.setField('scopeLabel', v)}
            />
          </Field>
          {oneDoctor && (
            <Field label="Doctor" required>
              <Select
                value={doctorName}
                options={doctors.map((d) => d.name)}
                onChange={(name) =>
                  form.setField(
                    'doctorId',
                    doctors.find((d) => d.name === name)?.id ?? values.doctorId,
                  )
                }
              />
            </Field>
          )}
          {scope === 'weekday' && (
            <Field
              label="Repeat for"
              hint="No hospital setting defines a scheduling horizon, so this defaults to 4 weeks."
            >
              <Select
                value={values.weeks}
                options={WEEK_OPTIONS}
                onChange={(v) => form.setField('weeks', v)}
              />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-4.5">
            <Field label="From" required>
              <Select
                value={values.from}
                options={TIME_OPTS}
                onChange={(v) => form.setField('from', v)}
              />
            </Field>
            <Field label="To" required error={form.errorFor('to')}>
              <Select
                value={values.to}
                options={TIME_OPTS}
                onChange={(v) => form.setField('to', v)}
                onBlur={() => form.blurField('to')}
              />
            </Field>
          </div>
          <Field label="Action" required>
            <Select
              value={values.action}
              options={ACTION_OPTIONS}
              onChange={(v) => form.setField('action', v as BulkAction)}
            />
          </Field>
          <div
            className={
              refs.length === 0
                ? 'border-border-soft text-body text-text-muted flex items-center gap-2 rounded-md border border-dashed px-3.5 py-3'
                : 'bg-bg-tint text-body text-text-navy flex items-center gap-2 rounded-md px-3.5 py-3'
            }
          >
            <Icon name={refs.length === 0 ? 'circle-alert' : 'layers'} size={16} />
            {refs.length === 0
              ? `No ${values.action === 'Block' ? 'available' : 'blocked'} slots in that range for ${scopeCopy}.`
              : `${refs.length} slot${refs.length === 1 ? '' : 's'} will be ${
                  values.action === 'Block' ? 'blocked' : 'opened'
                } for ${scopeCopy}. Booked and past slots are skipped.`}
          </div>
        </div>
      </FormModal>

      <ConfirmModal
        open={confirming}
        danger={values.action === 'Block'}
        confirmLabel={`${values.action} ${refs.length} slot${refs.length === 1 ? '' : 's'}`}
        title={values.action === 'Block' ? 'Block Slots' : 'Open Slots'}
        body={`${values.action} ${refs.length} slot${refs.length === 1 ? '' : 's'} for ${scopeCopy}? ${
          values.action === 'Block'
            ? 'Patients can no longer book them in the Medibook app.'
            : 'They become bookable in the Medibook app again.'
        }`}
        onClose={() => setConfirming(false)}
        onConfirm={apply}
      />
    </>
  );
}
