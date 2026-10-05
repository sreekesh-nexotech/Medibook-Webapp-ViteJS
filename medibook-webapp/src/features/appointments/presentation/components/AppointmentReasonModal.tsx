import { useState } from 'react';

import { Button } from '@/shared/ui/Button';
import { Field } from '@/shared/ui/Field';
import { Modal } from '@/shared/ui/Modal';

/** Shortest reason the desk may record — the patient sees it. */
const MIN_REASON_LENGTH = 3;

interface AppointmentReasonModalProps {
  open: boolean;
  title: string;
  /** What happens, in plain words (e.g. the full-refund rule). */
  body: string;
  confirmLabel: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

/**
 * A reason prompt for the desk's irreversible actions — cancel, reject and
 * refund. Each refunds in full to the original payment method(s) (Q11, Q94,
 * Q95), so there is no amount or channel to choose, only the reason.
 */
export function AppointmentReasonModal({
  open,
  title,
  body,
  confirmLabel,
  busy,
  onClose,
  onConfirm,
}: AppointmentReasonModalProps) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const error =
    touched && reason.trim().length < MIN_REASON_LENGTH ? 'Enter a short reason.' : null;

  const confirm = (): void => {
    setTouched(true);
    if (reason.trim().length < MIN_REASON_LENGTH) return;
    onConfirm(reason.trim());
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width={480}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Keep booking
          </Button>
          <Button variant="danger" onClick={confirm} busy={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-body text-text-body mb-4">{body}</p>
      <Field label="Reason" required error={error}>
        {(field) => (
          <textarea
            id={field.id}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="e.g. Doctor unavailable — patient informed"
            className="rounded-input border-border text-body text-text-strong box-border h-20 w-full resize-none border p-3"
          />
        )}
      </Field>
    </Modal>
  );
}
