import { useNavigate } from 'react-router-dom';

import { hospitalDashboardPath, opsPath } from '@/app/router/paths';

import { useAuthStore } from '@/features/auth/application/store/auth.store';

/**
 * "Back to dashboard" for screens that render outside a shell (not-found,
 * forbidden): resolves the right home for the signed-in session — the ops
 * dashboard for an ops user, the role's hospital dashboard otherwise.
 */
export interface HomeTarget {
  path: string;
  label: string;
  go: () => void;
}

export function useHomeTarget(): HomeTarget {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.role);
  const path = role === 'ops' ? opsPath('dashboard') : hospitalDashboardPath(role);
  const label = role === 'ops' ? 'Back to Operations Dashboard' : 'Back to Dashboard';
  return { path, label, go: () => navigate(path, { replace: true }) };
}
