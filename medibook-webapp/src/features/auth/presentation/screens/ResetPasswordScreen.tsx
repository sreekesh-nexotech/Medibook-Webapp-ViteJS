import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';

import { isFailure } from '@/core/error/failure';

import { AUTH_LOGIN_PATH, AUTH_TOKEN_PARAM } from '@/app/router/paths';

import type { AuthSurface } from '@/features/auth/domain/entities/auth.types';
import { usePasswordResetMutation } from '@/features/auth/application/queries/usePasswordResetMutation';
import { AuthAlert } from '@/features/auth/presentation/components/AuthAlert';
import { AuthPasswordField } from '@/features/auth/presentation/components/AuthPasswordField';
import {
  newPasswordProblem,
  passwordFailureMessage,
} from '@/features/auth/presentation/components/authPassword';
import { BrandPanel } from '@/features/auth/presentation/components/BrandPanel';

const INVALID_LINK_MESSAGE = 'This reset link is invalid or has expired. Request a new one.';

interface ResetPasswordScreenProps {
  /** Which staff surface the emailed link belongs to (`/reset-password` vs `/ops/reset-password`). */
  surface: AuthSurface;
}

/**
 * Set a new password from the emailed link (`…/reset-password?token=…`).
 * Same frame as the forgot-password screen: form state → done state. A
 * missing or expired token is explained, with the way back to login.
 */
export function ResetPasswordScreen({ surface }: ResetPasswordScreenProps) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get(AUTH_TOKEN_PARAM) ?? '';
  const reset = usePasswordResetMutation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const back = () => navigate(AUTH_LOGIN_PATH, { replace: true });

  const submit = () => {
    const problem = newPasswordProblem(password, confirm);
    if (problem) {
      setErr(problem);
      return;
    }
    setErr('');
    reset.mutate(
      { surface, token, newPassword: password },
      {
        onError: (error) => {
          if (!isFailure(error)) {
            setErr('Something went wrong. Please try again.');
          } else if (error.kind === 'unauthorized') {
            setErr(INVALID_LINK_MESSAGE);
          } else {
            setErr(passwordFailureMessage(error, 'new_password'));
          }
        },
      },
    );
  };

  const clearErr = () => {
    if (err) setErr('');
  };

  return (
    <div className="flex h-full bg-white">
      <BrandPanel />
      <div className="flex flex-1 items-center justify-center overflow-y-auto p-10">
        <div className="w-full max-w-100">
          <button
            type="button"
            onClick={back}
            className="text-body text-text-muted mb-7 inline-flex cursor-pointer items-center gap-2 font-medium"
          >
            <Icon name="arrow-left" size={18} /> Back to login
          </button>
          {!token ? (
            <div className="text-center">
              <div className="bg-d-100 text-d-500 mx-auto mb-5.5 flex size-18 items-center justify-center rounded-full">
                <Icon name="triangle-alert" size={34} />
              </div>
              <div className="text-h2 text-text-strong mb-2.5">This link is incomplete</div>
              <p className="text-body text-text-muted mx-auto mb-7 max-w-80">
                Open the reset link from your email again, or request a new one from the login
                screen.
              </p>
              <Button variant="info" className="h-13.5 w-full rounded-sm" onClick={back}>
                Back to Login
              </Button>
            </div>
          ) : reset.isSuccess ? (
            <div className="text-center">
              <div className="bg-g-100 text-g-600 mx-auto mb-5.5 flex size-18 items-center justify-center rounded-full">
                <Icon name="circle-check" size={34} />
              </div>
              <div className="text-h2 text-text-strong mb-2.5">Password updated</div>
              <p className="text-body text-text-muted mx-auto mb-7 max-w-80">
                Sign in with your new password. For your security, every device that was signed in
                has been signed out.
              </p>
              <Button variant="info" className="h-13.5 w-full rounded-sm" onClick={back}>
                Back to Login
              </Button>
            </div>
          ) : (
            <>
              <div className="text-display text-text-strong mb-2">Set a new password</div>
              <p className="text-body text-text-muted mb-7.5">
                Choose a password you haven't used here before — at least 10 characters, without
                your name or email.
              </p>
              <div className="flex flex-col gap-5">
                <AuthPasswordField
                  label="New Password"
                  value={password}
                  onChange={(v) => {
                    setPassword(v);
                    clearErr();
                  }}
                />
                <AuthPasswordField
                  label="Confirm New Password"
                  value={confirm}
                  onChange={(v) => {
                    setConfirm(v);
                    clearErr();
                  }}
                />
                {err && <AuthAlert message={err} />}
                <Button
                  variant="info"
                  icon="key-round"
                  className="h-13.5 w-full rounded-sm"
                  onClick={submit}
                  busy={reset.isPending}
                >
                  Update Password
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
