import { useState } from 'react';

import { Button } from '@/shared/ui/Button';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import { useSessionQuery } from '@/features/auth/application/queries/useSessionQuery';
import { useApprovePatientChangeMutation } from '@/features/patients/application/queries/useApprovePatientChangeMutation';
import { useRejectPatientChangeMutation } from '@/features/patients/application/queries/useRejectPatientChangeMutation';
import type {
  PatientChangeDecision,
  PatientChangeKind,
} from '@/features/patients/domain/entities/patients.entities';
import { saveErrorMessage } from '@/features/patients/presentation/components/patientsFormat';

/**
 * Backend permission that may decide change requests. It is not one of the
 * ten modules in the shared RBAC grid, so it is read off the session directly.
 */
const DECIDE_PERMISSION = 'patient_approvals.edit';

const DECIDE_FAILED = 'The request could not be updated. Please try again.';

/** `ApprovalNoteRequest.note` max length (`schema.yml`). */
const NOTE_MAX_LENGTH = 1000;

interface PatientDecisionActionsProps {
  requestId: string;
  kind: PatientChangeKind;
  /** The requester's user id, when the server sends it. */
  requestedByUserId: string | null;
  /** After a successful decision (e.g. leave a record that was just deleted). */
  onDecided?: (decision: PatientChangeDecision) => void;
  size?: 'sm';
}

/**
 * Approve / Reject for one patient change request (D-29). Shown only to a
 * user who may decide; reject needs a note. The person who asked for the
 * change cannot approve it (the backend refuses that too, L-09), so their own
 * request shows who has to decide instead of buttons.
 */
export function PatientDecisionActions({
  requestId,
  kind,
  requestedByUserId,
  onDecided,
  size,
}: PatientDecisionActionsProps) {
  const session = useSessionQuery('hospital');
  const canDecide = session.data?.permissions.includes(DECIDE_PERMISSION) ?? false;
  const isOwnRequest = requestedByUserId !== null && requestedByUserId === session.data?.user.id;

  const approve = useApprovePatientChangeMutation();
  const reject = useRejectPatientChangeMutation();
  const [isRejecting, setIsRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [isNoteTouched, setIsNoteTouched] = useState(false);
  const noteError = note.trim() === '' ? 'A note is required to reject.' : undefined;
  const isBusy = approve.isPending || reject.isPending;

  if (!canDecide) return null;

  if (isOwnRequest) {
    return (
      <span className="text-caption text-text-muted">
        Your request — another administrator must decide it.
      </span>
    );
  }

  const handleApprove = (): void => {
    approve.mutate(requestId, {
      onSuccess: (decision) => {
        toast(kind === 'delete' ? 'Deletion approved' : 'Change approved', 'success');
        onDecided?.(decision);
      },
      onError: (error) => toast(saveErrorMessage(error, DECIDE_FAILED), 'error'),
    });
  };

  const handleReject = (): void => {
    setIsNoteTouched(true);
    if (noteError) return;
    reject.mutate(
      { requestId, note: note.trim() },
      {
        onSuccess: (decision) => {
          toast('Request rejected', 'success');
          setIsRejecting(false);
          onDecided?.(decision);
        },
        onError: (error) => toast(saveErrorMessage(error, DECIDE_FAILED), 'error'),
      },
    );
  };

  return (
    <div className="flex gap-2">
      <Button
        size={size}
        variant="secondary"
        disabled={isBusy}
        onClick={() => setIsRejecting(true)}
      >
        Reject
      </Button>
      <Button size={size} busy={approve.isPending} disabled={isBusy} onClick={handleApprove}>
        Approve
      </Button>
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
    </div>
  );
}
