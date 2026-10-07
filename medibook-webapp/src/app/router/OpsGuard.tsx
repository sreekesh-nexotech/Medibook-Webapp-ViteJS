import { Navigate } from 'react-router-dom';

import { isFailure } from '@/core/error/failure';

import { OpsShell } from '@/app/layouts/OpsShell';
import { loginPathFor } from '@/app/router/paths';
import { SessionError } from '@/app/router/SessionError';
import { SessionLoading } from '@/app/router/SessionLoading';
import { useSessionExit } from '@/app/router/useSessionExit';

import { useSessionQuery } from '@/features/auth/application/queries/useSessionQuery';
import { platformSessionOf } from '@/features/auth/application/store/auth.roles';

/**
 * Guard for the `/ops/*` layout. Validates the stored platform tokens with
 * `GET /platform/me` before rendering: no tokens or a refused session →
 * login; still checking → spinner; server unreachable → retry.
 */
export function OpsGuard() {
  const session = useSessionQuery('platform');
  const { logout } = useSessionExit('platform');
  const data = platformSessionOf(session.data);

  if (!data) {
    if (session.isError) {
      if (isFailure(session.error) && session.error.kind === 'unauthorized') {
        return <Navigate to={loginPathFor('platform')} replace />;
      }
      return (
        <SessionError
          message={isFailure(session.error) ? session.error.message : undefined}
          onRetry={() => void session.refetch()}
          onLogout={logout}
        />
      );
    }
    if (session.fetchStatus === 'idle') return <Navigate to={loginPathFor('platform')} replace />;
    return <SessionLoading />;
  }

  return <OpsShell session={data} onLogout={logout} />;
}
