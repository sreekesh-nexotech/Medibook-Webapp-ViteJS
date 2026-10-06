import { Navigate } from 'react-router-dom';

import { isFailure } from '@/core/error/failure';

import { AUTH_LOGIN_PATH, hospitalDashboardPath, OPS_BASE_PATH } from '@/app/router/paths';
import { SessionLoading } from '@/app/router/SessionLoading';

import { useSessionQuery } from '@/features/auth/application/queries/useSessionQuery';
import { hospitalUrlRole } from '@/features/auth/application/store/auth.roles';
import { hasStoredSession } from '@/features/auth/application/usecases/hasStoredSession';

/** Any hospital URL role works here — the guard redirects to the session's own. */
const FALLBACK_HOSPITAL_ROLE = 'receptionist';

/**
 * `/` lands on the right home (spec §6 routing rules): a stored hospital
 * session → that role's dashboard, a stored ops session → the ops dashboard,
 * nothing → login. The destination's guard re-validates the session.
 */
export function RootRedirect() {
  const hasHospital = hasStoredSession('hospital');
  const hospital = useSessionQuery('hospital', hasHospital);

  if (hasHospital) {
    if (hospital.data?.surface === 'hospital') {
      return (
        <Navigate to={hospitalDashboardPath(hospitalUrlRole(hospital.data.role.code))} replace />
      );
    }
    if (hospital.isPending && hospital.fetchStatus !== 'idle') return <SessionLoading />;
    // Could not check (network/server): hand over to the guard, which offers a retry.
    if (
      hospital.isLoadingError &&
      !(isFailure(hospital.error) && hospital.error.kind === 'unauthorized')
    ) {
      return <Navigate to={hospitalDashboardPath(FALLBACK_HOSPITAL_ROLE)} replace />;
    }
  }
  if (hasStoredSession('platform')) return <Navigate to={OPS_BASE_PATH} replace />;
  return <Navigate to={AUTH_LOGIN_PATH} replace />;
}
