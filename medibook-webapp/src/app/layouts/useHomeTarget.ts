import { useLocation, useNavigate } from 'react-router-dom';

import { hospitalDashboardPath, OPS_BASE_PATH, opsPath, ROOT_PATH } from '@/app/router/paths';

import { useSessionQuery } from '@/features/auth/application/queries/useSessionQuery';
import {
  hospitalSessionOf,
  hospitalUrlRole,
  platformSessionOf,
} from '@/features/auth/application/store/auth.roles';

/**
 * "Back to dashboard" for screens that render outside a shell (not-found,
 * forbidden): resolves the right home for the signed-in session — the ops
 * dashboard under `/ops` or for an ops-only session, the hospital role's
 * dashboard otherwise, and the root (which sends to login) when signed out.
 */
export interface HomeTarget {
  path: string;
  label: string;
  go: () => void;
}

export function useHomeTarget(): HomeTarget {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const hospital = hospitalSessionOf(useSessionQuery('hospital').data);
  const platform = platformSessionOf(useSessionQuery('platform').data);
  const toOps = pathname.startsWith(OPS_BASE_PATH) ? platform !== null : !hospital && !!platform;

  let path = ROOT_PATH;
  let label = 'Back to sign in';
  if (toOps) {
    path = opsPath('dashboard');
    label = 'Back to Operations Dashboard';
  } else if (hospital) {
    path = hospitalDashboardPath(hospitalUrlRole(hospital.role.code));
    label = 'Back to Dashboard';
  }
  return { path, label, go: () => navigate(path, { replace: true }) };
}
