import { Suspense } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import type { ApiSurface } from '@/core/api/surface';
import { isFailure } from '@/core/error/failure';

import { ReportDownloadScreen } from '@/app/router/lazyScreens';
import { hospitalDashboardPath, loginReturningTo, OPS_BASE_PATH } from '@/app/router/paths';
import { SessionError } from '@/app/router/SessionError';
import { SessionLoading } from '@/app/router/SessionLoading';
import { useSessionExit } from '@/app/router/useSessionExit';

import { useSessionQuery } from '@/features/auth/application/queries/useSessionQuery';
import {
  hospitalSessionOf,
  hospitalUrlRole,
  platformSessionOf,
} from '@/features/auth/application/store/auth.roles';

/** Shown when the backend has suspended the hospital (login still works, D-30). */
const SUSPENDED_MESSAGE =
  "This hospital's Medibook instance is suspended by operations. Contact support@medibook.in to reactivate.";

interface ReportDownloadGuardProps {
  /** Which session the emailed link belongs to: `/ops/…` links are the platform's. */
  surface: ApiSurface;
}

/**
 * Guard for the emailed report links (`/reports/downloads/:fileId` and
 * `/ops/reports/downloads/:fileId`). Like the console guards it validates the
 * stored session with `/me` before rendering, but a signed-out visitor is sent
 * to sign-in with the link as `next`, so they come back to the file instead of
 * the dashboard. The page renders outside the shells, so it brings its own
 * `Suspense` for the lazy screen.
 */
export function ReportDownloadGuard({ surface }: ReportDownloadGuardProps) {
  const { pathname } = useLocation();
  const session = useSessionQuery(surface);
  const { logout } = useSessionExit(surface);

  const hospital = surface === 'hospital' ? hospitalSessionOf(session.data) : null;
  const platform = surface === 'platform' ? platformSessionOf(session.data) : null;

  if (!hospital && !platform) {
    if (session.isLoadingError) {
      if (isFailure(session.error) && session.error.kind === 'unauthorized') {
        return <Navigate to={loginReturningTo(pathname)} replace />;
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
    if (session.fetchStatus === 'idle') return <Navigate to={loginReturningTo(pathname)} replace />;
    return <SessionLoading />;
  }

  if (hospital?.hospital.status === 'suspended') {
    return (
      <SessionError title="Hospital suspended" message={SUSPENDED_MESSAGE} onLogout={logout} />
    );
  }

  const homePath = hospital
    ? hospitalDashboardPath(hospitalUrlRole(hospital.role.code))
    : OPS_BASE_PATH;

  return (
    <Suspense fallback={<SessionLoading />}>
      <ReportDownloadScreen homePath={homePath} />
    </Suspense>
  );
}
