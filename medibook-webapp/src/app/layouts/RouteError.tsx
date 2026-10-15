import { useEffect } from 'react';
import { useLocation, useRouteError } from 'react-router-dom';

import { reportError, reportIdFor } from '@/core/error/monitoring';
import { shortReference } from '@/core/error/reference';

import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';

import { OPS_BASE_PATH } from '@/app/router/paths';
import { useSessionExit } from '@/app/router/useSessionExit';
import { isStaleBuildError, reloadForNewBuild } from '@/app/staleBuild';

/**
 * Where any uncaught error in the route tree lands (RUN-02) — in a guard, a
 * top bar, a sidebar or the sign-in screen — instead of React Router's default
 * page, which prints the stack. Offers Reload and Log out; an error from a
 * deploy that removed this screen's code reloads by itself once. Any other
 * error is reported to monitoring, and its id is shown for support (OBS-01).
 */
export function RouteError() {
  const error = useRouteError();
  const { pathname } = useLocation();
  const { logout } = useSessionExit(pathname.startsWith(OPS_BASE_PATH) ? 'platform' : 'hospital');
  const stale = isStaleBuildError(error);
  const reference = stale ? null : reportIdFor(error);

  useEffect(() => {
    if (stale) reloadForNewBuild();
    else reportError(error, { source: 'route' });
  }, [error, stale]);

  return (
    <div className="bg-bg-app flex min-h-full items-center justify-center p-5">
      <ErrorState
        title="Something went wrong"
        message="This screen hit a problem and stopped. Reloading usually fixes it; nothing you saved has been lost."
        reference={reference ? shortReference(reference) : null}
      >
        <Button icon="refresh-cw" onClick={() => window.location.reload()}>
          Reload
        </Button>
        <Button variant="secondary" icon="log-out" onClick={logout}>
          Log out
        </Button>
      </ErrorState>
    </div>
  );
}
