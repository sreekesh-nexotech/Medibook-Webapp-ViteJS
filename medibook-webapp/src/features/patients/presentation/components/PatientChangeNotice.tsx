import { useState } from 'react';

import { calendarDate, fmtDate } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import { useSessionQuery } from '@/features/auth/application/queries/useSessionQuery';
import { useApprovePatientChangeMutation } from '@/features/patients/application/queries/useApprovePatientChangeMutation';
import { useRejectPatientChangeMutation } from '@/features/patients/application/queries/useRejectPatientChangeMutation';
import type { PendingPatientChange } from '@/features/patients/domain/entities/patients.entities';
import {
  changedFieldsText,
  saveErrorMessage,
} from '@/features/patients/presentation/components/patientsFormat';

/**
 * Backend permission that may decide change requests. It is not one of the
 * ten modules in the shared RBAC grid, so it is read off the session directly.
 */
const DECIDE_PERMISSION = 'patient_approvals.edit';

const DECIDE_FAILED = 'The request could not be updated. Please try again.';

/** `ApprovalNoteRequest.note` max length (`schema.yml`). */
const NOTE_MAX_LENGTH = 1000;

interface PatientChangeNoticeProps {
  change: PendingPatientChange;
}

/**
 * D-29: an edit or delete on this record is waiting for an admin. Everyone
 * sees the notice; a user who may decide gets Approve / Reject (reject needs
 * a note).
 */
export function PatientChangeNotice({ change }: PatientChangeNoticeProps) {
  const session = useSessionQuery('hospital');
  const canDecide = session.data?.permissions.includes(DECIDE_PERMISSION) ?? false;

  const approve = useApprovePatientChangeMutation();
  const reject = useRejectPatientChangeMutation();
  const [isRejecting, setIsRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [isNoteTouched, setIsNoteTouched] = useState(false);
  const noteError = note.trim() === '' ? 'A note is required to reject.' : undefined;

  const isBusy = approve.isPending || reject.isPending;
  const what =
    change.kind === 'delete'
      ? 'Deleting this record'
      : `A change to ${changedFieldsText(change.changedFields) || 'this record'}`;

  const handleApprove = (): void => {
    approve.mutate(change.id, {
      onSuccess: () =>
        toast(change.kind === 'delete' ? 'Deletion approved' : 'Change approved', 'success'),
      onError: (error) => toast(saveErrorMessage(error, DECIDE_FAILED), 'error', error),
    });
  };

  const handleReject = (): void => {
    setIsNoteTouched(true);
    if (noteError) return;
    reject.mutate(
      { requestId: change.id, note: note.trim() },
      {
        onSuccess: () => {
          toast('Request rejected', 'success');
          setIsRejecting(false);
        },
        onError: (error) => toast(saveErrorMessage(error, DECIDE_FAILED), 'error', error),
      },
    );
  };

  return (
    <Card pad={18} className="flex flex-wrap items-center gap-4">
      <Icon name="info" size={18} className="text-blue flex-none" />
      <div className="min-w-60 flex-1">
        <div className="text-body text-text-strong font-medium">
          {what} is waiting for admin approval.
        </div>
        <div className="text-caption text-text-muted mt-1">
          Requested {fmtDate(calendarDate(change.requestedAt))}. The record shows the current
          details until it is approved.
        </div>
      </div>
      {canDecide && (
        <div className="flex gap-2">
          <Button variant="secondary" disabled={isBusy} onClick={() => setIsRejecting(true)}>
            Reject
          </Button>
          <Button busy={approve.isPending} disabled={isBusy} onClick={handleApprove}>
            Approve
          </Button>
        </div>
      )}
      <FormModal
        open={isRejecting}
        onClose={() => setIsRejecting(false)}
        title="Reject request"
        width={440}
        onSubmit={handleReject}
        submitLabel="Reject"
        submitVariant="danger"
        busy={reject.isPending}
      >
        <Field label="Note" required error={isNoteTouched ? noteError : undefined}>
          <TextInput
            value={note}
            onChange={setNote}
            onBlur={() => setIsNoteTouched(true)}
            maxLength={NOTE_MAX_LENGTH}
            placeholder="Why is this change being turned down?"
          />
        </Field>
      </FormModal>
    </Card>
  );
}
