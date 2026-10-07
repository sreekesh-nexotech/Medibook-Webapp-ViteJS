import { useState } from 'react';

import { isFailure } from '@/core/error/failure';

import { useOpsPermission } from '@/shared/hooks/useOpsPermission';
import { cn } from '@/shared/lib/cn';
import { email as emailRule } from '@/shared/lib/validate';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { OpsField } from '@/shared/ui/OpsField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import type { FirstAdminInvitation } from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import { useResendAdminInvitationMutation } from '@/features/ops-hospitals/application/queries/useResendAdminInvitationMutation';
import { longDateFromTimestamp } from '@/features/ops-hospitals/presentation/components/hospitals.dates';
import { invitationStatusCopy } from '@/features/ops-hospitals/presentation/components/hospitals.view';

interface FirstAdminInvitationCardProps {
  hospitalId: string;
  hospitalName: string;
  /** `null` when the server reports none (never invited, or an older backend). */
  invitation: FirstAdminInvitation | null;
  /** Whether a blocker says nobody accepted (used when the server sends no status block). */
  adminAccepted: boolean;
}

/**
 * The hospital's first administrator (CORE-04): who was invited, when it was
 * sent and expires, and — while nobody has accepted — a re-send, optionally
 * to a corrected address. Re-sending needs `hospitals.edit`.
 */
export function FirstAdminInvitationCard({
  hospitalId,
  hospitalName,
  invitation,
  adminAccepted,
}: FirstAdminInvitationCardProps) {
  const canEdit = useOpsPermission().can('hospitals.edit');
  const resend = useResendAdminInvitationMutation();
  const [isEditing, setIsEditing] = useState(false);
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const accepted = invitation?.adminAccepted ?? adminAccepted;
  const canResend = canEdit && invitation !== null && invitation.canResend;

  const send = (email?: string) => {
    resend.mutate(
      { hospitalId, resend: email ? { email } : {} },
      {
        onSuccess: (inv) => {
          toast(`Invitation sent to ${inv.email}.`, 'success');
          setIsEditing(false);
        },
        onError: (failure) => {
          if (isFailure(failure) && failure.fieldErrors.email) {
            setError(failure.fieldErrors.email.join(' '));
            return;
          }
          toast(isFailure(failure) ? failure.message : 'The invitation was not sent.', 'error');
        },
      },
    );
  };

  const submitNewAddress = () => {
    const problem = emailRule(address.trim());
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    send(address.trim());
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle>Hospital Administrator</SectionTitle>
        {canResend && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon="pencil"
              onClick={() => {
                setAddress(invitation.email);
                setError(null);
                setIsEditing(true);
              }}
            >
              Change email
            </Button>
            <Button size="sm" icon="send" busy={resend.isPending} onClick={() => send()}>
              Re-send invitation
            </Button>
          </div>
        )}
      </div>
      <div className="mt-3 flex items-start gap-3">
        <div
          className={cn(
            'flex size-9 flex-none items-center justify-center rounded-md',
            accepted ? 'bg-g-100 text-g-600' : 'bg-y-100 text-y-600',
          )}
        >
          <Icon name={accepted ? 'user-check' : 'user-plus'} size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-body text-text-strong font-medium">
            {invitation
              ? invitationStatusCopy(invitation)
              : accepted
                ? 'An administrator has accepted the invitation.'
                : 'Waiting for the first administrator to accept.'}
          </div>
          {invitation && (
            <div className="text-caption text-text-muted">
              {[invitation.firstName, invitation.lastName].filter(Boolean).join(' ')} · invited{' '}
              {longDateFromTimestamp(invitation.invitedAt)}
              {invitation.resendCount > 0 &&
                ` · re-sent ${invitation.resendCount} of ${invitation.maxResends} times, last ${longDateFromTimestamp(invitation.lastSentAt)}`}
              {!invitation.adminAccepted &&
                ` · link ${invitation.status === 'expired' ? 'expired' : 'expires'} ${longDateFromTimestamp(invitation.expiresAt)}`}
            </div>
          )}
          {!invitation && !accepted && (
            <div className="text-caption text-text-muted">
              The first administrator is invited when the hospital is created.
            </div>
          )}
        </div>
      </div>
      {isEditing && (
        <FormModal
          open
          onClose={() => setIsEditing(false)}
          title="Send the invitation to another address"
          width={480}
          onSubmit={submitNewAddress}
          submitLabel="Send invitation"
          busy={resend.isPending}
        >
          <p className="text-body text-text-muted mt-0 mb-4">
            {hospitalName}&apos;s current invitation is replaced. The new link is valid for 7 days.
          </p>
          <OpsField label="Administrator email" required error={error}>
            <TextInput value={address} onChange={setAddress} type="email" autoComplete="email" />
          </OpsField>
        </FormModal>
      )}
    </Card>
  );
}
