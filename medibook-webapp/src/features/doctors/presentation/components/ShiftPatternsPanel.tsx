import { useState } from 'react';

import { TIME_OPTS } from '@/features/doctors/application/store/catalog.fixtures';
import { useCatalogStore } from '@/features/doctors/application/store/catalog.store';
import type { ShiftPattern } from '@/features/doctors/application/store/catalog.types';
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
import { toast } from '@/shared/ui/toast/toast.store';

interface PatternForm {
  name: string;
  from: string;
  to: string;
}

const PATTERN_VALIDATORS: FormValidators<PatternForm> = {
  name: (v) => required(v, 'Pattern name'),
  to: (v, values) => {
    const from = timeLabelToMinutes(values.from);
    const to = timeLabelToMinutes(v);
    if (from == null || to == null) return 'Pick a start and an end time.';
    return to > from ? undefined : 'The end time must be after the start time.';
  },
};

interface PatternModalProps {
  pattern: ShiftPattern | null;
  onClose: () => void;
}

/** Add / edit one reusable shift pattern. */
function PatternModal({ pattern, onClose }: PatternModalProps) {
  const catSavePattern = useCatalogStore((s) => s.catSavePattern);
  const form = useForm<PatternForm>({
    initial: {
      name: pattern?.name ?? '',
      from: pattern?.from ?? '9:00 am',
      to: pattern?.to ?? '1:00 pm',
    },
    validate: PATTERN_VALIDATORS,
    onSubmit: (values) => {
      catSavePattern({
        id: pattern?.id,
        name: values.name.trim(),
        from: values.from,
        to: values.to,
      });
      toast(pattern ? 'Shift pattern updated' : 'Shift pattern added', 'success');
      onClose();
    },
  });
  return (
    <FormModal
      open
      onClose={onClose}
      title={pattern ? 'Edit Shift Pattern' : 'Add Shift Pattern'}
      width={520}
      onSubmit={form.handleSubmit}
      submitLabel={pattern ? 'Save Pattern' : 'Add Pattern'}
    >
      <div className="flex flex-col gap-4.5">
        <Field
          label="Pattern Name"
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
              options={TIME_OPTS}
              onChange={(v) => form.setField('from', v)}
            />
          </Field>
          <Field label="Ends" required error={form.errorFor('to')}>
            <Select
              value={form.values.to}
              options={TIME_OPTS}
              onChange={(v) => form.setField('to', v)}
              onBlur={() => form.blurField('to')}
            />
          </Field>
        </div>
      </div>
    </FormModal>
  );
}

/**
 * The hospital's shift-pattern library (audit 2.4 / HA-06: "shift patterns …
 * have no working control"). Patterns are named, reusable windows — defined
 * once here, assigned to any doctor's days in the Working Hours grid above,
 * and read by the slot grid when it generates slots.
 *
 * The design's two hardcoded "Shift 1 / Shift 2" rows, whose red buttons
 * toasted "Shift removed" and changed nothing (audit 3.1.2), are replaced by
 * this: every row is a real record, and Remove really removes it.
 */
export function ShiftPatternsPanel() {
  const patterns = useCatalogStore((s) => s.patterns);
  const docs = useCatalogStore((s) => s.docs);
  const catDeletePattern = useCatalogStore((s) => s.catDeletePattern);
  const [editing, setEditing] = useState<{ pattern: ShiftPattern | null } | null>(null);
  const [removing, setRemoving] = useState<ShiftPattern | null>(null);

  const assignedCount = (id: string): number =>
    docs.filter((d) => d.week.some((w) => (w.patternIds ?? []).includes(id))).length;

  const confirmRemove = (): void => {
    if (!removing) return;
    catDeletePattern(removing.id);
    toast(`Shift pattern “${removing.name}” removed`, 'info');
    setRemoving(null);
  };

  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className="text-body text-text-strong font-medium">Shift Patterns</span>
        <InfoDot text="Named, reusable consultation windows. Assign them to a doctor's days in Working Hours; the slot grid generates slots from them." />
        <span className="flex-1" />
        <Can perm={'Doctors & Departments.add'}>
          <Button
            size="sm"
            variant="ghost"
            icon="plus"
            onClick={() => setEditing({ pattern: null })}
          >
            Add Shift Pattern
          </Button>
        </Can>
      </div>
      {patterns.length === 0 ? (
        <EmptyState
          compact
          icon="calendar-clock"
          title="No shift patterns yet"
          message="Create one — “Morning OPD 9–1” — and assign it to the days this doctor consults."
          actionLabel="Add Shift Pattern"
          actionIcon="plus"
          onAction={() => setEditing({ pattern: null })}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {patterns.map((p) => {
            const used = assignedCount(p.id);
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
                    {p.from} – {p.to} · assigned to {used} doctor{used === 1 ? '' : 's'}
                  </div>
                </div>
                <Can perm={'Doctors & Departments.edit'}>
                  <IconBtn
                    name="pencil"
                    label="Edit shift pattern"
                    title={`Edit ${p.name}`}
                    box={32}
                    size={15}
                    onClick={() => setEditing({ pattern: p })}
                  />
                </Can>
                <Can perm={'Doctors & Departments.del'}>
                  <IconBtn
                    name="trash-2"
                    label="Remove shift"
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
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmModal
        open={Boolean(removing)}
        danger
        confirmLabel="Remove"
        title="Remove Shift Pattern"
        body={
          removing
            ? `Remove “${removing.name}” (${removing.from} – ${removing.to})? It is assigned to ${assignedCount(
                removing.id,
              )} doctor${assignedCount(removing.id) === 1 ? '' : 's'} and will be unassigned from every day it covers.`
            : ''
        }
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
