import { useState } from 'react';

import type { ShiftPattern, WeekDay } from '@/features/doctors/application/store/catalog.types';
import { timeLabelToMinutes } from '@/features/doctors/domain/calendar';
import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { required } from '@/shared/lib/validate';
import { Button } from '@/shared/ui/Button';
import { Can } from '@/shared/ui/Can';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { IconBtn } from '@/shared/ui/IconBtn';
import { InfoDot } from '@/shared/ui/InfoDot';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';

import { timeOptionsWith } from './doctors.view';

/** Prefix of draft pattern ids (new, not yet saved) — never sent to the API. */
const DRAFT_ID_PREFIX = 'draft-';

interface PatternForm {
  name: string;
  from: string;
  to: string;
}

const PATTERN_VALIDATORS: FormValidators<PatternForm> = {
  name: (v) => required(v, 'Session name'),
  to: (v, values) => {
    const from = timeLabelToMinutes(values.from);
    const to = timeLabelToMinutes(v);
    if (from == null || to == null) return 'Pick a start and an end time.';
    return to > from ? undefined : 'The end time must be after the start time.';
  },
};

interface PatternModalProps {
  pattern: ShiftPattern | null;
  onSave: (pattern: Omit<ShiftPattern, 'id'>) => void;
  onClose: () => void;
}

/** Add / edit one of this doctor's named sessions. */
function PatternModal({ pattern, onSave, onClose }: PatternModalProps) {
  const form = useForm<PatternForm>({
    initial: {
      name: pattern?.name ?? '',
      from: pattern?.from ?? '9:00 am',
      to: pattern?.to ?? '1:00 pm',
    },
    validate: PATTERN_VALIDATORS,
    onSubmit: (values) => {
      onSave({ name: values.name.trim(), from: values.from, to: values.to });
      onClose();
    },
  });
  return (
    <FormModal
      open
      onClose={onClose}
      title={pattern ? 'Edit Session' : 'Add Session'}
      width={520}
      onSubmit={form.handleSubmit}
      submitLabel={pattern ? 'Save Session' : 'Add Session'}
    >
      <div className="flex flex-col gap-4.5">
        <Field
          label="Session Name"
          required
          error={form.errorFor('name')}
          hint="Shown on the day chips, e.g. “Morning OPD”."
        >
          <TextInput
            value={form.values.name}
            placeholder="e.g. Morning OPD"
            onChange={(v) => form.setField('name', v)}
            onBlur={() => form.blurField('name')}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4.5">
          <Field label="Starts" required>
            <Select
              value={form.values.from}
              options={timeOptionsWith(form.values.from)}
              onChange={(v) => form.setField('from', v)}
            />
          </Field>
          <Field label="Ends" required error={form.errorFor('to')}>
            <Select
              value={form.values.to}
              options={timeOptionsWith(form.values.to)}
              onChange={(v) => form.setField('to', v)}
              onBlur={() => form.blurField('to')}
            />
          </Field>
        </div>
      </div>
    </FormModal>
  );
}

interface ShiftPatternsPanelProps {
  /** This doctor's named sessions (the draft the profile's Save commits). */
  patterns: readonly ShiftPattern[];
  week: readonly WeekDay[];
  /** Reports the next patterns and the week with any removed pattern unassigned. */
  onChange: (patterns: readonly ShiftPattern[], week: readonly WeekDay[]) => void;
}

/**
 * This doctor's named consultation sessions ("Morning OPD 9–1"), assigned to
 * days in Working Hours above. The backend stores sessions per doctor, so
 * these belong to this doctor only; edits are part of the profile draft and
 * are saved — with a dry run for bookings — by Save Changes.
 */
export function ShiftPatternsPanel({ patterns, week, onChange }: ShiftPatternsPanelProps) {
  const [editing, setEditing] = useState<{ pattern: ShiftPattern | null } | null>(null);
  const [removing, setRemoving] = useState<ShiftPattern | null>(null);

  const assignedDays = (id: string): number =>
    week.filter((w) => w.on && (w.patternIds ?? []).includes(id)).length;

  const save = (target: ShiftPattern | null, values: Omit<ShiftPattern, 'id'>): void => {
    if (target) {
      onChange(
        patterns.map((p) => (p.id === target.id ? { ...values, id: target.id } : p)),
        week,
      );
      return;
    }
    onChange([...patterns, { ...values, id: `${DRAFT_ID_PREFIX}${crypto.randomUUID()}` }], week);
  };

  const confirmRemove = (): void => {
    if (!removing) return;
    const id = removing.id;
    onChange(
      patterns.filter((p) => p.id !== id),
      week.map((w) =>
        (w.patternIds ?? []).includes(id)
          ? { ...w, patternIds: (w.patternIds ?? []).filter((x) => x !== id) }
          : w,
      ),
    );
    setRemoving(null);
  };

  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className="text-body text-text-strong font-medium">Sessions</span>
        <InfoDot text="This doctor's named consultation windows. Assign them to days in Working Hours; changes are saved with Save Changes." />
        <span className="flex-1" />
        <Can perm={'Doctors & Departments.add'}>
          <Button
            size="sm"
            variant="ghost"
            icon="plus"
            onClick={() => setEditing({ pattern: null })}
          >
            Add Session
          </Button>
        </Can>
      </div>
      {patterns.length === 0 ? (
        <EmptyState
          compact
          icon="calendar-clock"
          title="No sessions yet"
          message="Create one — “Morning OPD 9–1” — and assign it to the days this doctor consults."
          actionLabel="Add Session"
          actionIcon="plus"
          onAction={() => setEditing({ pattern: null })}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {patterns.map((p) => {
            const used = assignedDays(p.id);
            return (
              <div
                key={p.id}
                className="border-border-soft flex flex-wrap items-center gap-3 rounded-md border px-3.5 py-3"
              >
                <div className="bg-blue-soft-bg text-blue flex size-8.5 flex-none items-center justify-center rounded-md">
                  <Icon name="clock" size={17} />
                </div>
                <div className="min-w-40 flex-1">
                  <div className="text-body text-text-strong font-medium">{p.name}</div>
                  <div className="text-caption text-text-muted">
                    {p.from} – {p.to} · used on {used} day{used === 1 ? '' : 's'}
                  </div>
                </div>
                <Can perm={'Doctors & Departments.edit'}>
                  <IconBtn
                    name="pencil"
                    label="Edit session"
                    title={`Edit ${p.name}`}
                    box={32}
                    size={15}
                    onClick={() => setEditing({ pattern: p })}
                  />
                </Can>
                <Can perm={'Doctors & Departments.del'}>
                  <IconBtn
                    name="trash-2"
                    label="Remove session"
                    title={`Remove ${p.name}`}
                    box={32}
                    size={15}
                    color="var(--color-d-500)"
                    onClick={() => setRemoving(p)}
                  />
                </Can>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <PatternModal
          key={editing.pattern?.id ?? 'new-pattern'}
          pattern={editing.pattern}
          onSave={(values) => save(editing.pattern, values)}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmModal
        open={Boolean(removing)}
        danger
        confirmLabel="Remove"
        title="Remove Session"
        body={
          removing
            ? `Remove “${removing.name}” (${removing.from} – ${removing.to})? It is unassigned from the ${assignedDays(
                removing.id,
              )} day${assignedDays(removing.id) === 1 ? '' : 's'} it covers when you save.`
            : ''
        }
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
