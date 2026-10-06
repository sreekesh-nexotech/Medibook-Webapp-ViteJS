import { useEffect } from 'react';
import { useLocation, useRouteError } from 'react-router-dom';

import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';

import { OPS_BASE_PATH } from '@/app/router/paths';
import { useSessionExit } from '@/app/router/useSessionExit';
import { isStaleBuildError, reloadForNewBuild } from '@/app/staleBuild';

/**
 * Where any uncaught error in the route tree lands (RUN-02) — in a guard, a
 * top bar, a sidebar or the sign-in screen — instead of React Router's default
 * page, which prints the stack. Offers Reload and Log out; an error from a
 * deploy that removed this screen's code reloads by itself once.
 */
export function RouteError() {
  const error = useRouteError();
  const { pathname } = useLocation();
  const { logout } = useSessionExit(pathname.startsWith(OPS_BASE_PATH) ? 'platform' : 'hospital');

  useEffect(() => {
    if (isStaleBuildError(error)) reloadForNewBuild();
  }, [error]);

  return (
    <div className="bg-bg-app flex min-h-full items-center justify-center p-5">
      <ErrorState
        title="Something went wrong"
        message="This screen hit a problem and stopped. Reloading usually fixes it; nothing you saved has been lost."
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
