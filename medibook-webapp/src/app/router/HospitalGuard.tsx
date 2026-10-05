import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { isFailure } from '@/core/error/failure';

import { HospitalShell } from '@/app/layouts/HospitalShell';
import {
  AUTH_LOGIN_PATH,
  hospitalDashboardPath,
  isHospitalRole,
  ROOT_PATH,
} from '@/app/router/paths';
import { SessionError } from '@/app/router/SessionError';
import { SessionLoading } from '@/app/router/SessionLoading';
import { useSessionExit } from '@/app/router/useSessionExit';

import { useSessionQuery } from '@/features/auth/application/queries/useSessionQuery';
import {
  hospitalSessionOf,
  hospitalUrlRole,
  syncAuthStore,
} from '@/features/auth/application/store/auth.roles';

/** Shown when the backend has suspended the hospital (login still works, D-30). */
const SUSPENDED_MESSAGE =
  "This hospital's Medibook instance is suspended by operations. Contact support@medibook.in to reactivate.";

/**
 * Guard for the `/:role/*` layout. Validates the stored tokens with
 * `GET /hospital/me` before rendering anything (no auto-login on unvalidated
 * data): no tokens or a refused session → login; still checking → spinner;
 * server unreachable → retry; suspended hospital → explained, with log out.
 * The URL role must match the session's role (admin → `/admin`, every other
 * hospital role → `/receptionist`); a mismatch redirects to the right one.
 */
export function HospitalGuard() {
  const { role: roleParam } = useParams();
  const session = useSessionQuery('hospital');
  const { logout } = useSessionExit('hospital');
  const data = hospitalSessionOf(session.data);

  useEffect(() => {
    if (data) syncAuthStore(data);
  }, [data]);

  if (!isHospitalRole(roleParam)) return <Navigate to={ROOT_PATH} replace />;

  if (!data) {
    if (session.isError) {
      if (isFailure(session.error) && session.error.kind === 'unauthorized') {
        return <Navigate to={AUTH_LOGIN_PATH} replace />;
      }
      return (
        <SessionError
          message={isFailure(session.error) ? session.error.message : undefined}
          onRetry={() => void session.refetch()}
          onLogout={logout}
        />
      );
    }
    // Disabled query (no stored tokens) → signed out; otherwise still checking.
    if (session.fetchStatus === 'idle') return <Navigate to={AUTH_LOGIN_PATH} replace />;
    return <SessionLoading />;
  }

  if (data.hospital.status === 'suspended') {
    return (
      <SessionError title="Hospital suspended" message={SUSPENDED_MESSAGE} onLogout={logout} />
    );
  }

  const urlRole = hospitalUrlRole(data.role.code);
  if (urlRole !== roleParam) return <Navigate to={hospitalDashboardPath(urlRole)} replace />;

  return <HospitalShell role={roleParam} session={data} onLogout={logout} />;
}
