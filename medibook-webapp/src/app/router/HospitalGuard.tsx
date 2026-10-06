import { Navigate, useParams } from 'react-router-dom';
import { setCalendarZone } from '@/shared/lib/format';

import { isFailure } from '@/core/error/failure';

import { HospitalShell } from '@/app/layouts/HospitalShell';
import { AUTH_LOGIN_PATH, hospitalDashboardPath, isHospitalRole } from '@/app/router/paths';
import { SessionError } from '@/app/router/SessionError';
import { SessionLoading } from '@/app/router/SessionLoading';
import { useSessionExit } from '@/app/router/useSessionExit';

import { useSessionQuery } from '@/features/auth/application/queries/useSessionQuery';
import { hospitalSessionOf, hospitalUrlRole } from '@/features/auth/application/store/auth.roles';
import { NotFoundScreen } from '@/app/layouts/NotFoundScreen';
import { OfflineSession } from '@/app/router/SessionError';

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

  // RUN-10: an unknown first segment (`/foo`) is an unknown page, not a reason to redirect.
  if (!isHospitalRole(roleParam)) return <NotFoundScreen />;

  if (!data) {
    if (session.isLoadingError) {
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
    // RUN-03: offline, the check waits for the network instead of spinning forever.
    if (session.fetchStatus === 'paused') return <OfflineSession onLogout={logout} />;
    return <SessionLoading />;
  }

  // Before any screen renders, so their "today" is the hospital's (DATA-02).
  // Idempotent, which is why it can run during render.
  setCalendarZone(data.hospital.timezone);

  if (data.hospital.status === 'suspended') {
    return (
      <SessionError title="Hospital suspended" message={SUSPENDED_MESSAGE} onLogout={logout} />
    );
  }

  const urlRole = hospitalUrlRole(data.role.code);
  if (urlRole !== roleParam) return <Navigate to={hospitalDashboardPath(urlRole)} replace />;

  return <HospitalShell role={roleParam} session={data} onLogout={logout} />;
}
