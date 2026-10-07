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
import {
  isOwnChangeRequest,
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

interface PatientDecisionActionsProps {
  requestId: string;
  kind: PatientChangeKind;
  /** The requester's user id, when the server sends it. */
  requestedByUserId: string | null;
  /** The requester's name — the fallback when the row carries no id. */
  requestedByName: string | null;
  /** After a successful decision (e.g. leave a record that was just deleted). */
  onDecided?: (decision: PatientChangeDecision) => void;
  size?: 'sm';
}

/**
 * Approve / Reject for one patient change request (D-29). Shown only to a
 * user who may decide; reject needs a note. The person who asked for the
 * change cannot approve it (the backend refuses that too, L-09); they may
 * still withdraw it, which the backend records as a rejection.
 */
export function PatientDecisionActions({
  requestId,
  kind,
  requestedByUserId,
  requestedByName,
  onDecided,
  size,
}: PatientDecisionActionsProps) {
  const session = useSessionQuery('hospital');
  const canDecide = session.data?.permissions.includes(DECIDE_PERMISSION) ?? false;
  const isOwnRequest = isOwnChangeRequest(
    requestedByUserId,
    requestedByName,
    session.data?.user ?? null,
  );

  const approve = useApprovePatientChangeMutation();
  const reject = useRejectPatientChangeMutation();
  const [isRejecting, setIsRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [isNoteTouched, setIsNoteTouched] = useState(false);
  const noteError = note.trim() === '' ? 'A note is required to reject.' : undefined;
  const isBusy = approve.isPending || reject.isPending;

  if (!canDecide) return null;

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
          toast(isOwnRequest ? 'Request withdrawn' : 'Request rejected', 'success');
          setIsRejecting(false);
          onDecided?.(decision);
        },
        onError: (error) => toast(saveErrorMessage(error, DECIDE_FAILED), 'error'),
      },
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isOwnRequest && (
        <span className="text-caption text-text-muted">
          Your request — another administrator approves it.
        </span>
      )}
      <Button
        size={size}
        variant="secondary"
        disabled={isBusy}
        onClick={() => setIsRejecting(true)}
      >
        {isOwnRequest ? 'Withdraw' : 'Reject'}
      </Button>
      {!isOwnRequest && (
        <Button size={size} busy={approve.isPending} disabled={isBusy} onClick={handleApprove}>
          Approve
        </Button>
      )}
      <FormModal
        open={isRejecting}
        onClose={() => setIsRejecting(false)}
        title={isOwnRequest ? 'Withdraw your request' : 'Reject request'}
        width={440}
        onSubmit={handleReject}
        submitLabel={isOwnRequest ? 'Withdraw' : 'Reject'}
        submitVariant="danger"
        busy={reject.isPending}
      >
        <Field label="Note" required error={isNoteTouched ? noteError : undefined}>
          <TextInput
            value={note}
            onChange={setNote}
            onBlur={() => setIsNoteTouched(true)}
            maxLength={NOTE_MAX_LENGTH}
            placeholder={
              isOwnRequest ? 'Why are you withdrawing it?' : 'Why is this change being turned down?'
            }
          />
        </Field>
      </FormModal>
    </div>
  );
}
