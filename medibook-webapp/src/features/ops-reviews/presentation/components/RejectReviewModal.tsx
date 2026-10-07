import { useState } from 'react';

import { FormModal } from '@/shared/ui/FormModal';
import { OpsField } from '@/shared/ui/OpsField';
import { TextArea } from '@/shared/ui/TextArea';

/** Backend limit on a rejection reason (`PlatformReviewRejectSerializer`). */
const REASON_MAX = 2000;

interface RejectReviewModalProps {
  doctorName: string;
  busy: boolean;
  onClose: () => void;
  onReject: (reason: string | null) => void;
}

/** Reject (or take down) a review; the optional reason goes to the audit trail. */
export function RejectReviewModal({ doctorName, busy, onClose, onReject }: RejectReviewModalProps) {
  const [reason, setReason] = useState('');
  return (
    <FormModal
      open
      onClose={onClose}
      title={`Reject this review of ${doctorName}?`}
      width={520}
      onSubmit={() => onReject(reason.trim() === '' ? null : reason.trim())}
      submitLabel="Reject review"
      submitVariant="danger"
      busy={busy}
    >
      <div className="flex flex-col gap-3">
        <p className="text-body text-text-muted m-0">
          It is hidden from the app and leaves the doctor&apos;s and hospital&apos;s rating. The
          patient is not told.
        </p>
        <OpsField label="Reason (optional)" hint="Kept in the compliance log, not shown to anyone.">
          <TextArea
            value={reason}
            onChange={setReason}
            maxLength={REASON_MAX}
            rows={3}
            placeholder="e.g. Contains a phone number"
          />
        </OpsField>
      </div>
    </FormModal>
  );
}
