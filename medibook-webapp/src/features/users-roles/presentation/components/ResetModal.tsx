import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { cn } from '@/shared/lib/cn';
import { minLen } from '@/shared/lib/validate';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import type { IconName } from '@/shared/ui/icon-registry';
import { PasswordInput } from '@/shared/ui/PasswordInput';
import { toast } from '@/shared/ui/toast/toast.store';

import { useSendPasswordResetMutation } from '@/features/users-roles/application/queries/useSendPasswordResetMutation';
import {
  failureText,
  type UserRow,
} from '@/features/users-roles/presentation/components/usersRoles.viewModel';

type ResetMethod = 'email' | 'otp' | 'manual';

interface ResetForm {
  method: ResetMethod;
  password: string;
}

const PASSWORD_MIN = 8;

/**
 * `POST /hospital/staff/{id}/reset-password` emails a reset link — the only
 * reset the backend offers. Mobile OTP and an admin-set temporary password
 * have no endpoint, so they stay visible but disabled.
 */
const AVAILABLE_METHOD: ResetMethod = 'email';

/** Module-level so `useForm`'s error memo stays stable across renders. */
const RESET_VALIDATORS: FormValidators<ResetForm> = {
  password: (v, all) =>
    all.method === 'manual' ? minLen(v, PASSWORD_MIN, 'Temporary password') : undefined,
};

interface ResetModalProps {
  user: UserRow;
  onClose: () => void;
}

/**
 * Password reset / invite modal (design `Rbac.jsx` `ResetModal`): pick email
 * link, mobile OTP, or a manually set temporary password.
 *
 * A `FormModal` (Enter submits). Only the email link is sent — the backend
 * accepts it only for an active member with an email address, and its refusal
 * is shown as is. The copy says a link was sent, not that it was delivered.
 */
export function ResetModal({ user, onClose }: ResetModalProps) {
  const sendReset = useSendPasswordResetMutation();

  const form = useForm<ResetForm>({
    initial: { method: AVAILABLE_METHOD, password: '' },
    validate: RESET_VALIDATORS,
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

  const opts: readonly (readonly [ResetMethod, IconName, string, string])[] = [
    ['email', 'mail', 'Email reset link', user.email],
    ['otp', 'smartphone', 'Mobile OTP', user.phone],
    ['manual', 'key-round', 'Set temporary password', 'Share with the user securely'],
  ];
  const isManual = form.values.method === 'manual';

  return (
    <FormModal
      dirty={form.isDirty}
      open
      onClose={onClose}
      title="Reset Password"
      width={560}
      submitLabel={isManual ? 'Set Password' : 'Send'}
      busy={form.submitting}
      onSubmit={form.handleSubmit}
    >
      <p className="text-body-lg text-text-body mb-3.5">
        Reset the password for <b>{user.name}</b>. Choose how:
      </p>
      <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
        <legend className="sr-only">How to reset this password</legend>
        {opts.map(([k, ic, t, s]) => (
          <button
            type="button"
            key={k}
            aria-pressed={form.values.method === k}
            onClick={() => form.setField('method', k)}
            disabled={k !== AVAILABLE_METHOD}
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-md px-3.5 py-3 text-left disabled:cursor-not-allowed disabled:opacity-50',
              form.values.method === k
                ? 'border-blue bg-blue-soft-bg border-2'
                : 'border-border border bg-white',
            )}
          >
            <span
              className={cn(
                'flex size-9 flex-none items-center justify-center rounded-md',
                form.values.method === k ? 'bg-blue text-white' : 'bg-grey-300 text-text-muted',
              )}
            >
              <Icon name={ic} size={18} />
            </span>
            <span className="flex-1">
              <span className="text-body text-text-strong block font-medium">{t}</span>
              <span className="text-caption text-text-muted block">{s}</span>
            </span>
            {form.values.method === k && <Icon name="check" size={18} className="text-blue" />}
          </button>
        ))}
        {isManual && (
          <Field
            label="Temporary Password"
            required
            error={form.errorFor('password')}
            hint={`At least ${PASSWORD_MIN} characters`}
          >
            <PasswordInput
              value={form.values.password}
              onChange={(v) => form.setField('password', v)}
              onBlur={() => form.blurField('password')}
              placeholder="Enter a temporary password"
              autoComplete="new-password"
            />
          </Field>
        )}
        <div className="text-caption text-text-muted">
          Mobile OTP and setting a temporary password are not available yet.
        </div>
      </fieldset>
    </FormModal>
  );
}
