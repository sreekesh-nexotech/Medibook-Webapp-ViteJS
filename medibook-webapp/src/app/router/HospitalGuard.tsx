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
import { hospitalSessionOf, hospitalUrlRole } from '@/features/auth/application/store/auth.roles';

/**
 * Guard for the `/:role/*` layout. Validates the stored tokens with
 * `GET /hospital/me` before rendering anything (no auto-login on unvalidated
 * data): no tokens or a refused session → login; still checking → spinner;
 * server unreachable → retry. A suspended or read-only hospital still opens:
 * staff sign in and read, the shell banner says why, and `usePermission`
 * disables every write (decision 9, D-30; the tenant gate refuses writes).
 * The URL role must match the session's role (admin → `/admin`, every other
 * hospital role → `/receptionist`); a mismatch redirects to the right one.
 */
export function HospitalGuard() {
  const { role: roleParam } = useParams();
  const session = useSessionQuery('hospital');
  const { logout } = useSessionExit('hospital');
  const data = hospitalSessionOf(session.data);

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

  const urlRole = hospitalUrlRole(data.role.code);
  if (urlRole !== roleParam) return <Navigate to={hospitalDashboardPath(urlRole)} replace />;

  return <HospitalShell role={roleParam} session={data} onLogout={logout} />;
}
