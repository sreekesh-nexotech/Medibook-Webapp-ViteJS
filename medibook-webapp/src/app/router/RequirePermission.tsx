import { Outlet, useParams } from 'react-router-dom';

import { usePermission, type PermissionKey } from '@/shared/hooks/usePermission';

import { ForbiddenScreen } from '@/app/layouts/ForbiddenScreen';

interface RequirePermissionProps {
  /** Also require the URL's `:role` segment to be `admin`. */
  requireAdminRole?: boolean;
  /** Permission key(s) the role must hold — see `usePermission` for the vocabulary. */
  perm?: PermissionKey | readonly PermissionKey[];
  /** Require every key in `perm` rather than any one. */
  all?: boolean;
  /** Role name shown on the denial screen, e.g. "Administrator". */
  roleLabel?: string;
}

/**
 * Route guard that *explains* a denial instead of hiding it — audit 3.7:
 * `RequireAdmin` used to answer a role-gated URL with
 * `<Navigate to={dashboard} replace />`, so the link looked broken rather than
 * restricted, and the role model could not be demonstrated at all
 * (audit 2.4 / X-01).
 *
 * Checks the URL role and/or RBAC permission keys, and renders
 * `ForbiddenScreen` — naming the access that would be needed — when either
 * fails.
 */
export function RequirePermission({
  requireAdminRole = false,
  perm,
  all = false,
  roleLabel,
}: RequirePermissionProps) {
  const { role: roleParam } = useParams();
  const { canAll, canAny } = usePermission();

  if (requireAdminRole && roleParam !== 'admin') {
    return <ForbiddenScreen requiredRole={roleLabel ?? 'Administrator'} />;
  }

  if (perm) {
    const keys: readonly PermissionKey[] = typeof perm === 'string' ? [perm] : perm;
    const allowed = all ? canAll(...keys) : canAny(...keys);
    if (!allowed) {
      return (
        <ForbiddenScreen
          requiredRole={roleLabel}
          requiredPermission={keys.join(all ? ' + ' : ' or ')}
        />
      );
    }
  }

  return <Outlet />;
}
