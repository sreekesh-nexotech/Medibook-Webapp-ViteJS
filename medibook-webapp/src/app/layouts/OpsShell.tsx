import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { useIdleTimeout } from '@/shared/hooks/useIdleTimeout';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { OpsSkeleton } from '@/shared/ui/OpsSkeleton';

import {
  AUTH_LOGIN_PATH,
  opsHospitalDetailPath,
  opsPath,
  opsViewFromPath,
  type OpsStaticView,
  type OpsView,
} from '@/app/router/paths';

import { useAuthStore } from '@/features/auth/application/store/auth.store';
import { useOpsSettingsStore } from '@/features/ops-settings/application/store/opsSettings.store';

import { ErrorBoundary } from './ErrorBoundary';
import { OPS_DETAIL_PARENT, opsDocumentTitleFor } from './ops-nav';
import { OpsSidebar } from './OpsSidebar';
import { OpsTopbar } from './OpsTopbar';
import { ScreenError } from './ScreenError';
import { SidebarDrawer } from './SidebarDrawer';
import { useSidebarMode } from './useSidebarMode';
import { createViewHistory } from './view-history';

/** Skeleton duration on every view change (design behaviour). */
const SKELETON_MS = 450;

/**
 * Module-level visited-view stack (the prototype's `OpsShell` histRef);
 * recorded synchronously during render, cleared on logout.
 */
const history = createViewHistory<OpsView>();

/** Skeleton phase: which view is being revealed, and whether it is still loading. */
interface SkeletonPhase {
  readonly view: OpsView;
  readonly loading: boolean;
}

/** Ops console frame: sidebar + topbar + skeleton + error boundary (design `OpsShell`). */
export function OpsShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const sessTimeout = useOpsSettingsStore((s) => s.settings.sessTimeout);

  const view = opsViewFromPath(location.pathname);
  const navActive = OPS_DETAIL_PARENT[view] ?? view;

  // Responsive sidebar: `full` at >= lg (unchanged), a 76px icon rail at
  // md-lg, an off-canvas drawer below md (audit 3.4.1).
  const sidebarMode = useSidebarMode();
  const [navOpen, setNavOpen] = useState(false);

  useDocumentTitle(opsDocumentTitleFor(view));

  // 450ms skeleton on every view change — the loading flag flips on during
  // render (React's derive-while-rendering pattern) and off via the timer.
  const [phase, setPhase] = useState<SkeletonPhase>({ view, loading: true });
  if (phase.view !== view) setPhase({ view, loading: true });
  useEffect(() => {
    const t = setTimeout(
      () => setPhase((p) => (p.view === view ? { view, loading: false } : p)),
      SKELETON_MS,
    );
    return () => clearTimeout(t);
  }, [view]);
  const loading = phase.loading || phase.view !== view;

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

  const handleLogout = () => {
    logout();
    history.clear();
    navigate(AUTH_LOGIN_PATH);
  };

  // Audit 3.7.5 — the Session Timeout setting now has a timer behind it:
  // "30 min" means 30 idle minutes, with a warning at T-60s.
  const idleMinutes = Number.parseInt(sessTimeout, 10);
  const { warning, secondsLeft, stayActive } = useIdleTimeout({
    minutes: idleMinutes,
    onTimeout: handleLogout,
  });

  const sidebar = (mode: 'full' | 'rail') => (
    <OpsSidebar active={navActive} onNavigate={handleNavigate} mode={mode} />
  );

  return (
    <div className="bg-bg-app flex h-full overflow-hidden">
      {sidebarMode !== 'drawer' && sidebar(sidebarMode)}
      <div className="flex min-w-0 flex-1 flex-col">
        <OpsTopbar
          view={view}
          onNavigate={handleNavigate}
          onOpenHospital={(id) => navigate(opsHospitalDetailPath(id))}
          onLogout={handleLogout}
          onBack={onBack}
          onMenu={sidebarMode === 'full' ? undefined : () => setNavOpen(true)}
        />
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5">
          <ErrorBoundary
            key={view}
            fallback={(_err, reset) => (
              <ScreenError onRetry={reset} onHome={() => handleNavigate('dashboard')} />
            )}
          >
            {loading ? <OpsSkeleton /> : <Outlet />}
          </ErrorBoundary>
        </div>
      </div>
      <SidebarDrawer
        open={navOpen && sidebarMode !== 'full'}
        onClose={() => setNavOpen(false)}
        label="Operations navigation"
      >
        {sidebar('full')}
      </SidebarDrawer>
      <Modal
        open={warning}
        onClose={stayActive}
        title="Still there?"
        width={440}
        footer={
          <>
            <Button variant="secondary" icon="log-out" onClick={handleLogout}>
              Sign out now
            </Button>
            <Button icon="shield-check" onClick={stayActive}>
              Stay signed in
            </Button>
          </>
        }
      >
        <p className="text-body-lg text-text-body m-0 leading-[1.6]">
          You have been idle for a while. For security, this session signs out in{' '}
          <span className="text-text-strong font-semibold tabular-nums">{secondsLeft}s</span>. The
          session timeout is {sessTimeout}, set under Platform Settings.
        </p>
      </Modal>
    </div>
  );
}
