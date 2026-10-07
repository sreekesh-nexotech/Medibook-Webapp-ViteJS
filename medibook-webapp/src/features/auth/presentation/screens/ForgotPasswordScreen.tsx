import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';

import { isFailure } from '@/core/error/failure';

import { AUTH_SURFACE_PARAM, loginPathFor, surfaceFromParam } from '@/app/router/paths';

import { usePasswordForgotMutation } from '@/features/auth/application/queries/usePasswordForgotMutation';
import { AuthField } from '@/features/auth/presentation/components/AuthField';
import { BrandPanel } from '@/features/auth/presentation/components/BrandPanel';

/**
 * Forgot-password screen (design `Auth.jsx` `ForgotPassword`): the request
 * state (email + Send Mail) and the sent state (mail-check confirmation with
 * the email echo), plus the back-to-login link. Sends the request to the
 * surface the login screen came from (`?surface=ops` → operations). The
 * backend answers 202 for any address, so "sent" never reveals whether an
 * account exists.
 */

/** Lifetime of an emailed reset link (backend `password_reset.RESET_TTL`). */
const RESET_LINK_MINUTES = 15;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export function ForgotPasswordScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const surface = surfaceFromParam(params.get(AUTH_SURFACE_PARAM));
  const forgot = usePasswordForgotMutation();
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const sent = forgot.isSuccess;
  const back = () => navigate(loginPathFor(surface));

  const send = () => {
    if (!EMAIL_RE.test(email.trim())) {
      setErr('Enter a valid email address.');
      return;
    }
    setErr('');
    forgot.mutate(
      { surface, email: email.trim() },
      {
        onError: (error) =>
          setErr(isFailure(error) ? error.message : 'Something went wrong. Please try again.'),
      },
    );
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
          {!sent ? (
            <>
              <div className="text-text-strong mb-2 text-[32px] leading-[1.1] font-bold">
                Forgot Password?
              </div>
              <p className="text-body text-text-muted mb-7.5">
                Enter the email linked to your staff account and we'll send a reset link.
              </p>
              <div className="flex flex-col gap-5">
                <AuthField
                  label="Email Address"
                  value={email}
                  onChange={(v) => {
                    setEmail(v);
                    if (err) setErr('');
                  }}
                  placeholder={surface === 'platform' ? 'you@medibook.com' : 'you@hospital.med'}
                />
                {err && (
                  <div className="text-caption text-danger bg-d-100 flex items-center gap-2 rounded-sm px-3 py-2.5">
                    <Icon name="triangle-alert" size={15} /> {err}
                  </div>
                )}
                <Button
                  variant="info"
                  icon="mail"
                  className="h-13.5 w-full rounded-sm"
                  onClick={send}
                  busy={forgot.isPending}
                >
                  Send Mail
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center">
              <div className="bg-g-100 text-g-600 mx-auto mb-5.5 flex size-18 items-center justify-center rounded-full">
                <Icon name="mail-check" size={34} />
              </div>
              <div className="text-text-strong mb-2.5 text-[26px] font-bold">Check your inbox</div>
              <p className="text-body text-text-muted mx-auto mb-7 max-w-80">
                We've sent a password reset link to{' '}
                <b className="text-text-body">{email || 'your email'}</b>. The link expires in{' '}
                {RESET_LINK_MINUTES} minutes.
              </p>
              <Button variant="info" className="h-13.5 w-full rounded-sm" onClick={back}>
                Back to Login
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
