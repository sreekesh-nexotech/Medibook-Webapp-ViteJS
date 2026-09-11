import { useState } from 'react';

import { useCatalogStore } from '@/features/doctors/application/store/catalog.store';
import type { DoctorLeave, LeaveType } from '@/features/doctors/application/store/catalog.types';
import { todayIso } from '@/features/doctors/domain/calendar';
import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { fmtDate } from '@/shared/lib/format';
import { dateRange, required } from '@/shared/lib/validate';
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

/** Leave types offered by the editor (canonical set). */
const LEAVE_TYPES: readonly LeaveType[] = ['Casual', 'Sick', 'Conference'];

interface LeaveForm {
  from: string;
  to: string;
  type: LeaveType;
  reason: string;
}

const LEAVE_VALIDATORS: FormValidators<LeaveForm> = {
  from: (v) => required(v, 'Start date'),
  to: (v, values) => dateRange(values.from, v),
  reason: (v) => required(v, 'Reason'),
};

interface LeaveModalProps {
  doctorId: string;
  leave: DoctorLeave | null;
  onClose: () => void;
}

/** Add / edit one leave entry — a real date range, type and reason. */
function LeaveModal({ doctorId, leave, onClose }: LeaveModalProps) {
  const catSaveLeave = useCatalogStore((s) => s.catSaveLeave);
  const form = useForm<LeaveForm>({
    initial: {
      from: leave?.from ?? todayIso(),
      to: leave?.to ?? todayIso(),
      type: leave?.type ?? 'Casual',
      reason: leave?.reason ?? '',
    },
    validate: LEAVE_VALIDATORS,
    onSubmit: (values) => {
      catSaveLeave(doctorId, {
        id: leave?.id,
        from: values.from,
        to: values.to,
        type: values.type,
        reason: values.reason.trim(),
      });
      toast(leave ? 'Leave updated' : 'Leave added', 'success');
      onClose();
    },
  });
  return (
    <FormModal
      open
      onClose={onClose}
      title={leave ? 'Edit Leave' : 'Add Leave'}
      width={560}
      onSubmit={form.handleSubmit}
      submitLabel={leave ? 'Save Leave' : 'Add Leave'}
    >
      <div className="flex flex-col gap-4.5">
        <div className="grid grid-cols-2 gap-4.5">
          <Field label="From" required error={form.errorFor('from')}>
            <TextInput
              value={form.values.from}
              type="date"
              onChange={(v) => form.setField('from', v)}
              onBlur={() => form.blurField('from')}
            />
          </Field>
          <Field label="To" required error={form.errorFor('to')}>
            <TextInput
              value={form.values.to}
              type="date"
              onChange={(v) => form.setField('to', v)}
              onBlur={() => form.blurField('to')}
            />
          </Field>
        </div>
        <Field label="Leave Type" required>
          <Select
            value={form.values.type}
            options={LEAVE_TYPES}
            onChange={(v) => form.setField('type', v as LeaveType)}
          />
        </Field>
        <Field
          label="Reason"
          required
          error={form.errorFor('reason')}
          hint="Shown to the front desk, never to patients."
        >
          <TextInput
            value={form.values.reason}
            placeholder="e.g. Cardiology Society annual meet"
            onChange={(v) => form.setField('reason', v)}
            onBlur={() => form.blurField('reason')}
          />
        </Field>
      </div>
    </FormModal>
  );
}

interface LeavePanelProps {
  doctorId: string;
  leave: readonly DoctorLeave[];
}

/**
 * Leave / unavailability for one doctor (audit 2.4 / HA-06: "leave entry …
 * [has] no working control"; audit 3.1.2: the red button "announces a deletion
 * that does not happen").
 *
 * Every row here is a store record: Add and Edit open a real form with
 * validated dates, and Remove asks for confirmation and then actually removes
 * the row. The slot grid reads the same entries, so a doctor on leave has no
 * bookable slots on those dates.
 */
export function LeavePanel({ doctorId, leave }: LeavePanelProps) {
  const catDeleteLeave = useCatalogStore((s) => s.catDeleteLeave);
  const [editing, setEditing] = useState<{ leave: DoctorLeave | null } | null>(null);
  const [removing, setRemoving] = useState<DoctorLeave | null>(null);

  const confirmRemove = (): void => {
    if (!removing) return;
    catDeleteLeave(doctorId, removing.id);
    toast('Leave removed', 'info');
    setRemoving(null);
  };

  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className="text-body text-text-strong font-medium">Leave / Unavailability</span>
        <InfoDot text="Block dates the doctor is unavailable. Booking is disabled in the app for these dates and the slot grid shows no slots." />
        <span className="flex-1" />
        <Can perm={'Doctors & Departments.add'}>
          <Button
            size="sm"
            variant="secondary"
            icon="plus"
            onClick={() => setEditing({ leave: null })}
          >
            Add Leave
          </Button>
        </Can>
      </div>
      {leave.length === 0 ? (
        <EmptyState
          compact
          icon="plane"
          title="No upcoming leave"
          message="Add a date range and the app stops offering slots for it."
          actionLabel="Add Leave"
          actionIcon="plus"
          onAction={() => setEditing({ leave: null })}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {leave.map((l) => (
            <div
              key={l.id}
              className="border-border-soft flex flex-wrap items-center gap-3 rounded-md border px-3.5 py-3"
            >
              <div className="bg-y-100 text-y-700 flex size-8.5 flex-none items-center justify-center rounded-md">
                <Icon name="plane" size={17} />
              </div>
              <div className="min-w-40 flex-1">
                <div className="text-body text-text-strong font-medium">
                  {l.from === l.to ? fmtDate(l.from) : `${fmtDate(l.from)} – ${fmtDate(l.to)}`}
                </div>
                <div className="text-caption text-text-muted">
                  {l.type} leave · {l.reason}
                </div>
              </div>
              <Can perm={'Doctors & Departments.edit'}>
                <IconBtn
                  name="pencil"
                  label="Edit leave"
                  box={32}
                  size={15}
                  onClick={() => setEditing({ leave: l })}
                />
              </Can>
              <Can perm={'Doctors & Departments.del'}>
                <IconBtn
                  name="trash-2"
                  label="Remove leave"
                  box={32}
                  size={15}
                  color="var(--color-d-500)"
                  onClick={() => setRemoving(l)}
                />
              </Can>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <LeaveModal
          key={editing.leave?.id ?? 'new-leave'}
          doctorId={doctorId}
          leave={editing.leave}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmModal
        open={Boolean(removing)}
        danger
        confirmLabel="Remove"
        title="Remove Leave"
        body={
          removing
            ? `Remove the ${removing.type.toLowerCase()} leave on ${
                removing.from === removing.to
                  ? fmtDate(removing.from)
                  : `${fmtDate(removing.from)} – ${fmtDate(removing.to)}`
              }? Those dates become bookable again.`
            : ''
        }
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
