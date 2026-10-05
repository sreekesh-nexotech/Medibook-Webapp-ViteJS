import { useState } from 'react';

import { Button } from '@/shared/ui/Button';

import { isFailure } from '@/core/error/failure';

import type { InvitationPreview, StaffSession } from '@/features/auth/domain/entities/auth.types';
import { useAcceptInvitationMutation } from '@/features/auth/application/queries/useAcceptInvitationMutation';
import { AuthAlert } from '@/features/auth/presentation/components/AuthAlert';
import { AuthField } from '@/features/auth/presentation/components/AuthField';
import { AuthPasswordField } from '@/features/auth/presentation/components/AuthPasswordField';
import {
  newPasswordProblem,
  passwordFailureMessage,
} from '@/features/auth/presentation/components/authPassword';

interface InvitationFormProps {
  token: string;
  invitation: InvitationPreview;
  onAccepted: (session: StaffSession) => void;
}

/**
 * The accept form for a loaded invitation. A separate component so its
 * fields start from the invitation's own name without syncing state.
 */
export function InvitationForm({ token, invitation, onAccepted }: InvitationFormProps) {
  const accept = useAcceptInvitationMutation();
  const [firstName, setFirstName] = useState(invitation.firstName);
  const [lastName, setLastName] = useState(invitation.lastName ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');

  const clearErr = () => {
    if (err) setErr('');
  };

  const submit = () => {
    if (!firstName.trim()) {
      setErr('Enter your first name.');
      return;
    }
    const problem = newPasswordProblem(password, confirm);
    if (problem) {
      setErr(problem);
      return;
    }
    setErr('');
    accept.mutate(
      {
        token,
        input: { password, firstName: firstName.trim(), lastName: lastName.trim() },
      },
      {
        onSuccess: onAccepted,
        onError: (error) =>
          setErr(
            isFailure(error)
              ? passwordFailureMessage(error, 'password')
              : 'Something went wrong. Please try again.',
          ),
      },
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-body text-text-muted">
        You'll sign in as <b className="text-text-body">{invitation.email}</b>.
      </p>
      <AuthField
        label="First Name"
        value={firstName}
        onChange={(v) => {
          setFirstName(v);
          clearErr();
        }}
      />
      <AuthField
        label="Last Name"
        value={lastName}
        onChange={(v) => {
          setLastName(v);
          clearErr();
        }}
      />
      <AuthPasswordField
        label={invitation.accountExists ? 'New Password for this Account' : 'Password'}
        value={password}
        onChange={(v) => {
          setPassword(v);
          clearErr();
        }}
      />
      <AuthPasswordField
        label="Confirm Password"
        value={confirm}
        onChange={(v) => {
          setConfirm(v);
          clearErr();
        }}
      />
      {invitation.accountExists && (
        <p className="text-caption text-text-muted">
          This email already has a Medibook account. Accepting sets the password above for it.
        </p>
      )}
      {err && <AuthAlert message={err} />}
      <Button
        variant="info"
        className="h-13.5 w-full rounded-sm"
        onClick={submit}
        busy={accept.isPending}
      >
        Accept & Sign In
      </Button>
    </div>
  );
}
