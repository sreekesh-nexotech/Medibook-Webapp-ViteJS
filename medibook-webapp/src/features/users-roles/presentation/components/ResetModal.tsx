import { useForm } from '@/shared/hooks/useForm';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { toast } from '@/shared/ui/toast/toast.store';

import { useSendPasswordResetMutation } from '@/features/users-roles/application/queries/useSendPasswordResetMutation';
import {
  failureText,
  type UserRow,
} from '@/features/users-roles/presentation/components/usersRoles.viewModel';

/**
 * `POST /hospital/staff/{id}/reset-password` emails a reset link. Mobile OTP
 * and an admin-set temporary password have no endpoint, so they are not
 * offered here.
 */

interface ResetModalProps {
  user: UserRow;
  onClose: () => void;
}

/**
 * Password reset modal: the backend only supports an emailed reset link.
 * A `FormModal` (Enter submits); the copy says a link was sent, not that it
 * was delivered.
 */
export function ResetModal({ user, onClose }: ResetModalProps) {
  const sendReset = useSendPasswordResetMutation();

  const form = useForm<Record<string, never>>({
    initial: {},
    onSubmit: async () => {
      try {
        await sendReset.mutateAsync(user.id);
        toast(
          `Reset link sent to ${user.email} · ${user.name} sets a new password from it`,
          'success',
        );
        onClose();
      } catch (error) {
        toast(failureText(error, 'Could not send the reset link.'), 'error', error);
      }
    },
  });

  return (
    <FormModal
      dirty={form.isDirty}
      open
      onClose={onClose}
      title="Reset Password"
      width={560}
      submitLabel="Send"
      busy={form.submitting}
      onSubmit={form.handleSubmit}
    >
      <p className="text-body-lg text-text-body mb-3.5">
        Send a password reset link to <b>{user.name}</b>?
      </p>
      <div className="border-border rounded-md border bg-white px-3.5 py-3">
        <div className="flex items-center gap-3">
          <span className="bg-blue-soft-bg text-blue flex size-9 flex-none items-center justify-center rounded-md">
            <Icon name="mail" size={18} />
          </span>
          <span className="flex-1">
            <span className="text-body text-text-strong block font-medium">Email reset link</span>
            <span className="text-caption text-text-muted block">{user.email}</span>
          </span>
        </div>
      </div>
    </FormModal>
  );
}
