import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';

import { DEFAULT_IDLE_MINUTES } from '@/core/config/session';
import { isFailure } from '@/core/error/failure';
import type { Failure } from '@/core/error/failure';

import {
  AUTH_FORGOT_PATH,
  AUTH_NEXT_PARAM,
  AUTH_SURFACE_OPS,
  AUTH_SURFACE_PARAM,
  hospitalDashboardPath,
  isOpsReturnPath,
  OPS_BASE_PATH,
  returnPathAfterLogin,
} from '@/app/router/paths';

import type { StaffSession } from '@/features/auth/domain/entities/auth.types';
import { useLoginMutation } from '@/features/auth/application/queries/useLoginMutation';
import { useLogoutMutation } from '@/features/auth/application/queries/useLogoutMutation';
import { hospitalUrlRole } from '@/features/auth/application/store/auth.roles';
import { AuthField } from '@/features/auth/presentation/components/AuthField';
import { BrandPanel } from '@/features/auth/presentation/components/BrandPanel';

type LoginMode = 'hospital' | 'ops';

const MODES: readonly (readonly [LoginMode, string])[] = [
  ['hospital', 'Hospital Login'],
  ['ops', 'Operations Login'],
];

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const SUSPENDED_MESSAGE =
  "This hospital's Medibook instance is suspended by operations. Contact support@medibook.in to reactivate.";

/** Sign-in failures worth wording for this screen; anything else shows the server's message. */
function loginErrorMessage(failure: Failure, isOps: boolean): string {
  if (failure.code === 'AUTH_INVALID_CREDENTIALS') return 'Incorrect email or password.';
  if (failure.code === 'PERMISSION_DENIED') {
    return isOps
      ? 'This account does not have access to the operations console.'
      : 'This account has no active hospital access. Contact your hospital administrator.';
  }
  return failure.message;
}

/**
 * Login screen (design `Auth.jsx` `Login`): the Hospital/Operations segmented
 * toggle, "Welcome Back" heading, email + password fields, the remember-me /
 * ops lock note, forgot-password link and email validation — now signing in
 * against `/<surface>/auth/login`, validating the session with `/me`, refusing
 * a suspended hospital, and landing on the session role's dashboard — or back
 * on the emailed report link that sent the user here (`?next=`).
 */
export function LoginScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get(AUTH_NEXT_PARAM);
  const loginMutation = useLoginMutation();
  const { mutate: logout } = useLogoutMutation();

  const [mode, setMode] = useState<LoginMode>(isOpsReturnPath(next) ? 'ops' : 'hospital');
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [show, setShow] = useState(false);
  // Off by default: front-desk terminals are shared (SEC-02).
  const [remember, setRemember] = useState(false);
  const [err, setErr] = useState('');
  const isOps = mode === 'ops';

  const pick = (m: LoginMode) => {
    if (m === mode) return;
    setMode(m);
    setErr('');
  };

  const land = (session: StaffSession) => {
    const back = returnPathAfterLogin(next, session.surface);
    if (session.surface === 'platform') {
      // `/ops` sends each platform role to the first screen it can open.
      navigate(back ?? OPS_BASE_PATH, { replace: true });
      return;
    }
    if (session.hospital.status === 'suspended') {
      // Login itself is never cut off (D-30); the app is. Sign straight back out.
      logout('hospital');
      setErr(SUSPENDED_MESSAGE);
      return;
    }
    navigate(back ?? hospitalDashboardPath(hospitalUrlRole(session.role.code)), {
      replace: true,
    });
  };

  const go = () => {
    if (!email.trim() || !pwd.trim()) {
      setErr('Enter your email and password to continue.');
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setErr('Enter a valid email address.');
      return;
    }
    setErr('');
    loginMutation.mutate(
      {
        surface: isOps ? 'platform' : 'hospital',
        // Ops sessions are never remembered (the copy below says so).
        credentials: { email: email.trim(), password: pwd, remember: !isOps && remember },
      },
      {
        onSuccess: land,
        onError: (error) => {
          setErr(isFailure(error) ? loginErrorMessage(error, isOps) : 'Something went wrong.');
        },
      },
    );
  };

  return (
    <div className="flex h-full bg-white">
      <BrandPanel />
      <div className="flex flex-1 items-center justify-center overflow-y-auto p-10">
        <div className="w-full max-w-100">
          <div className="border-border-input bg-bg-subtle mb-7.5 flex gap-1 rounded-md border p-1">
            {MODES.map(([k, l]) => (
              <button
                key={k}
                type="button"
                onClick={() => pick(k)}
                className={cn(
                  'flex-1 cursor-pointer rounded-sm py-2.25 text-center text-[13px] transition-colors duration-150',
                  mode === k
                    ? 'text-text-navy shadow-card bg-white font-semibold'
                    : 'text-text-muted bg-transparent font-medium',
                )}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="text-display text-text-strong mb-2">Welcome Back</div>
          <p className="text-body text-text-muted mb-8">
            {isOps
              ? 'Sign in to the Medibook operations console.'
              : "Sign in to your hospital's mbAdmin panel."}
          </p>
          {returnPathAfterLogin(next, isOps ? 'platform' : 'hospital') && (
            <div className="text-caption text-text-navy bg-blue-soft-bg mb-5 flex items-center gap-2 rounded-sm px-3 py-2.5">
              <Icon name="file-down" size={15} /> Sign in to download the report from your email.
            </div>
          )}
          <div className="flex flex-col gap-5">
            <AuthField
              label="Email Address"
              value={email}
              onChange={(v) => {
                setEmail(v);
                if (err) setErr('');
              }}
              placeholder={isOps ? 'you@medibook.com' : 'you@hospital.med'}
            />
            <AuthField
              label="Password"
              type={show ? 'text' : 'password'}
              value={pwd}
              onChange={(v) => {
                setPwd(v);
                if (err) setErr('');
              }}
              trailing={
                <button type="button" onClick={() => setShow((s) => !s)} className="flex">
                  <Icon name={show ? 'eye-off' : 'eye'} size={18} />
                </button>
              }
            />
            {err && (
              <div className="text-caption text-danger bg-d-100 flex items-center gap-2 rounded-sm px-3 py-2.5">
                <Icon name="triangle-alert" size={15} /> {err}
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              {isOps ? (
                <span className="text-caption text-text-muted inline-flex items-center gap-1.75">
                  <Icon name="lock" size={14} /> Sessions aren't remembered — sign in each time.
                </span>
              ) : (
                <label className="text-body text-text-body flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="accent-blue mt-0.5 size-4 flex-none"
                  />
                  <span>
                    Keep me signed in on this computer
                    <span className="text-caption text-text-muted block">
                      Only on your own computer. You are still signed out after{' '}
                      {DEFAULT_IDLE_MINUTES} minutes without use.
                    </span>
                  </span>
                </label>
              )}
              <button
                type="button"
                onClick={() =>
                  navigate(
                    isOps
                      ? `${AUTH_FORGOT_PATH}?${AUTH_SURFACE_PARAM}=${AUTH_SURFACE_OPS}`
                      : AUTH_FORGOT_PATH,
                  )
                }
                className="text-body text-link shrink-0 cursor-pointer font-medium"
              >
                Forgot Password?
              </button>
            </div>
            <Button
              variant="info"
              className="h-13.5 w-full rounded-sm"
              onClick={go}
              busy={loginMutation.isPending}
            >
              Login
            </Button>
          </div>
          <p className="text-caption text-text-faint mt-7 text-center">
            {isOps
              ? 'Restricted to Medibook operations staff.'
              : 'Trouble signing in? Contact your hospital administrator.'}
          </p>
        </div>
      </div>
    </div>
  );
}
