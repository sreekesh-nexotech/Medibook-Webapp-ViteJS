import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { useIdleTimeout } from '@/shared/hooks/useIdleTimeout';
import { useOpsPermission } from '@/shared/hooks/useOpsPermission';
import { OpsSkeleton } from '@/shared/ui/OpsSkeleton';

import { DEFAULT_IDLE_MINUTES } from '@/core/config/session';

import { OPS_HOME_PATH } from '@/app/router/opsAccess';
import {
  opsAccountPath,
  opsPath,
  opsViewFromPath,
  type OpsStaticView,
  type OpsView,
} from '@/app/router/paths';

import type { PlatformSession } from '@/features/auth/domain/entities/auth.types';
import { useOpsSettingsQuery } from '@/features/ops-settings/application/queries/useOpsSettingsQuery';

import { ErrorBoundary } from './ErrorBoundary';
import { IdleWarningModal } from './IdleWarningModal';
import { ConnectionNotice } from './ConnectionNotice';
import { OPS_DETAIL_PARENT, opsDocumentTitleFor } from './ops-nav';
import { OpsSidebar } from './OpsSidebar';
import { OpsTopbar } from './OpsTopbar';
import { ScreenError } from './ScreenError';
import { MAIN_CONTENT_ID, SkipLink } from './SkipLink';
import { SidebarDrawer } from './SidebarDrawer';
import { useSidebarMode } from './useSidebarMode';
import { createViewHistory } from './view-history';

/**
 * Module-level visited-view stack (the prototype's `OpsShell` histRef);
 * recorded synchronously during render, cleared when the shell unmounts
 * (logout or session expiry), so the next user never inherits it.
 */
const history = createViewHistory<OpsView>();

interface OpsShellProps {
  /** The validated session (`GET /platform/me`). */
  session: PlatformSession;
  onLogout: () => void;
}

/** Ops console frame: sidebar + topbar + error boundary (design `OpsShell`). */
export function OpsShell({ session, onLogout }: OpsShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = session;
  const userName = [user.firstName, user.lastName].filter(Boolean).join(' ');
  const { can } = useOpsPermission();
  // Only roles that may read platform settings ask for them (UAT-35).
  const settings = useOpsSettingsQuery(can('settings.view'));

  const view = opsViewFromPath(location.pathname);
  const navActive = OPS_DETAIL_PARENT[view] ?? view;

  // Responsive sidebar: `full` at >= lg (unchanged), a 76px icon rail at
  // md-lg, an off-canvas drawer below md (audit 3.4.1).
  const sidebarMode = useSidebarMode();
  const [navOpen, setNavOpen] = useState(false);

  useDocumentTitle(opsDocumentTitleFor(view));

  // History-aware back — recorded synchronously in render so availability is
  // correct immediately (exactly like the prototype).
  history.record(view, location.pathname);
  // Returns to the actual previous screen, wherever you came from.
  const onBack =
    history.depth() > 1
      ? () => {
          history.pop();
          const prev = history.pop();
          if (prev) navigate(prev.path);
        }
      : null;

  const handleNavigate = (target: OpsStaticView) => {
    setNavOpen(false);
    navigate(opsPath(target));
  };

  useEffect(() => () => history.clear(), []);

  const handleLogout = onLogout;

  // Audit 3.7.5 — the platform's Session Timeout setting has a timer behind
  // it, with a warning at T-60s. The limit comes from `/platform/me` (BE-21),
  // else from the settings for a role that may read them, else the backend's
  // default, so every platform role signs out when idle (SEC-12). Input in any
  // ops tab keeps every tab signed in (UAT-04).
  const idleMinutes =
    session.sessionTimeoutMin ?? settings.data?.sessionTimeoutMin ?? DEFAULT_IDLE_MINUTES;
  const { warning, secondsLeft, stayActive } = useIdleTimeout({
    minutes: idleMinutes,
    surface: 'platform',
    onTimeout: handleLogout,
  });

  const sidebar = (mode: 'full' | 'rail') => (
    <OpsSidebar active={navActive} onNavigate={handleNavigate} mode={mode} />
  );

  return (
    <div className="bg-bg-app flex h-full overflow-hidden">
      <SkipLink />
      {sidebarMode !== 'drawer' && sidebar(sidebarMode)}
      <div className="flex min-w-0 flex-1 flex-col">
        <OpsTopbar
          view={view}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          onAccount={() => {
            setNavOpen(false);
            navigate(opsAccountPath());
          }}
          userName={userName}
          userEmail={user.email}
          roleName={session.role.name}
          onBack={onBack}
          onMenu={sidebarMode === 'full' ? undefined : () => setNavOpen(true)}
        />
        <ConnectionNotice />
        <main
          id={MAIN_CONTENT_ID}
          tabIndex={-1}
          className="flex-1 overflow-y-auto p-3 outline-none sm:p-4 lg:p-5"
        >
          <ErrorBoundary
            key={view}
            fallback={(err, reset, reference) => (
              // `/ops` sends each role to the first screen it may open; not
              // every platform role has the dashboard (UAT-35).
              <ScreenError
                error={err}
                reference={reference}
                onRetry={reset}
                homeLabel="Back to start"
                onHome={() => {
                  setNavOpen(false);
                  navigate(OPS_HOME_PATH);
                }}
              />
            )}
          >
            {/* The skeleton shows only while a screen's code loads; each screen
                shows its own loading state for data, so a cached screen
                renders at once (PERF-06). */}
            <Suspense fallback={<OpsSkeleton />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      <SidebarDrawer
        open={navOpen && sidebarMode !== 'full'}
        onClose={() => setNavOpen(false)}
        label="Operations navigation"
      >
        {sidebar('full')}
      </SidebarDrawer>
      <IdleWarningModal
        open={warning}
        secondsLeft={secondsLeft}
        minutes={idleMinutes}
        onStay={stayActive}
        onSignOut={handleLogout}
      />
    </div>
  );
}
