import { useState } from 'react';

import { Button } from '@/shared/ui/Button';
import { Field } from '@/shared/ui/Field';
import { Modal } from '@/shared/ui/Modal';
import { toast } from '@/shared/ui/toast/toast.store';

import { isFailure } from '@/core/error/failure';

import type { DeskAppointment } from '@/features/appointments/domain/entities/appointments.entities';
import { useRemarkMutation } from '@/features/appointments/application/queries/appointments.mutations';

interface AppointmentRemarkModalProps {
  /** `null` = closed. */
  appt: DeskAppointment | null;
  onClose: () => void;
}

/**
 * Edit the desk remark — the one field of a booking the hospital may change
 * (v2 §7.2). Doctor, time and fee are fixed once booked; cancel and book
 * again to change them (D-14: no reschedule).
 */
export function AppointmentRemarkModal({ appt, onClose }: AppointmentRemarkModalProps) {
  if (!appt) return null;
  return <RemarkForm key={appt.id} appt={appt} onClose={onClose} />;
}

function RemarkForm({ appt, onClose }: { appt: DeskAppointment; onClose: () => void }) {
  const save = useRemarkMutation();
  const [remark, setRemark] = useState(appt.remark);

  const submit = (): void => {
    save.mutate(
      { id: appt.id, remark: remark.trim(), version: appt.version },
      {
        onSuccess: () => {
          toast('Remark saved', 'success');
          onClose();
        },
        onError: (failure) =>
          toast(
            isFailure(failure) ? failure.message : 'Could not save the remark.',
            'error',
            failure,
          ),
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit Remark"
      width={480}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} busy={save.isPending}>
            Save Remark
          </Button>
        </>
      }
    >
      <p className="text-caption text-text-muted mb-3">
        Doctor, time and fee cannot be changed once booked — cancel and book again instead.
      </p>
      <Field label="Remark" hint="Internal — for the desk and the doctor, not the patient.">
        {(field) => (
          <textarea
            id={field.id}
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            className="rounded-input border-border-control text-body text-text-strong box-border h-24 w-full resize-none border p-3"
          />
        )}
      </Field>
    </Modal>
  );
}
