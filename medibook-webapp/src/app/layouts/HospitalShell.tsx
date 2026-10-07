import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { DEFAULT_IDLE_MINUTES } from '@/core/config/session';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { useIdleTimeout } from '@/shared/hooks/useIdleTimeout';
import { usePermission } from '@/shared/hooks/usePermission';

import {
  hospitalAccountPath,
  hospitalPath,
  hospitalViewFromPath,
  type HospitalRole,
  type HospitalView,
} from '@/app/router/paths';

import type { HospitalSession } from '@/features/auth/domain/entities/auth.types';
import { useHospitalImageUrlQuery } from '@/features/settings/application/queries/useHospitalImageUrlQuery';

import { ErrorBoundary } from './ErrorBoundary';
import { IdleWarningModal } from './IdleWarningModal';
import { ConnectionNotice } from './ConnectionNotice';
import {
  documentTitleFor,
  moduleForView,
  NAV_PARENT,
  subFor,
  titleFor,
  viewAllowed,
  type HospitalNavView,
} from './hospital-nav';
import { HospitalSidebar } from './HospitalSidebar';
import { HospitalTopbar } from './HospitalTopbar';
import { ScreenError } from './ScreenError';
import { MAIN_CONTENT_ID, SkipLink } from './SkipLink';
import { ScreenLoading } from './ScreenLoading';
import { SidebarDrawer } from './SidebarDrawer';
import { useSidebarMode } from './useSidebarMode';
import { createViewHistory } from './view-history';

/**
 * Module-level visited-view stack (the prototype's `AppShell` histRef);
 * recorded synchronously during render, cleared when the shell unmounts
 * (logout or session expiry), so the next user never inherits it.
 */
const history = createViewHistory<HospitalView>();

interface HospitalShellProps {
  role: HospitalRole;
  /** The validated session (`GET /hospital/me`) — identity and hospital. */
  session: HospitalSession;
  onLogout: () => void;
}

/** Hospital app frame: sidebar + topbar + per-view error boundary (design `AppShell`). */
export function HospitalShell({ role, session, onLogout }: HospitalShellProps) {
  // SEC-01: background polls keep the server session alive, so the tab signs
  // itself out after the idle limit with no keyboard, mouse or touch input.
  const idle = useIdleTimeout({ minutes: DEFAULT_IDLE_MINUTES, onTimeout: onLogout });
  const location = useLocation();
  const navigate = useNavigate();
  const { canViewModule } = usePermission();
  const hospitalName = session.hospital.name;
  const { user } = session;
  const userName = [user.firstName, user.lastName].filter(Boolean).join(' ');

  // The hospital's own logo, from the session (`/hospital/me`), so every
  // role sees it; the sidebar shows the Medibook mark when there is none.
  const logoUrl = useHospitalImageUrlQuery(session.hospital.logoFileId);

  useEffect(() => () => history.clear(), []);

  // A view is reachable when the user's permissions allow its module; views
  // no module gates fall back to the design's role rule.
  const canSee = (target: HospitalView) => {
    const module = moduleForView(target);
    return module === undefined ? viewAllowed(role, target) : canViewModule(module);
  };

  const view = hospitalViewFromPath(location.pathname);
  const navActive = NAV_PARENT[view] ?? view;

  // Responsive sidebar: `full` at >= lg (unchanged), a 76px icon rail at
  // md-lg, an off-canvas drawer below md (audit 3.4.1).
  const sidebarMode = useSidebarMode();
  const [navOpen, setNavOpen] = useState(false);

  useDocumentTitle(documentTitleFor(role, view));

  // History-aware back — recorded synchronously in render so availability is
  // correct immediately (exactly like the prototype).
  history.record(view, location.pathname);
  const onBack =
    history.depth() > 1
      ? () => {
          history.pop();
          let prev = history.pop();
          while (prev && !canSee(prev.view)) prev = history.pop();
          if (prev) navigate(prev.path);
        }
      : null;

  const handleNavigate = (target: HospitalNavView) => {
    setNavOpen(false);
    navigate(hospitalPath(role, target));
  };

  const handleAccount = () => {
    setNavOpen(false);
    navigate(hospitalAccountPath(role));
  };

  const sidebar = (mode: 'full' | 'rail') => (
    <HospitalSidebar
      active={navActive}
      onNavigate={handleNavigate}
      role={role}
      hospitalName={hospitalName}
      logoSrc={logoUrl.data ?? null}
      mode={mode}
    />
  );

  return (
    <div className="bg-bg-app flex h-full overflow-hidden">
      <SkipLink />
      {sidebarMode !== 'drawer' && sidebar(sidebarMode)}
      <div className="flex min-w-0 flex-1 flex-col">
        <HospitalTopbar
          title={titleFor(role, view)}
          subtitle={subFor(role, view, user.firstName)}
          onBack={onBack}
          role={role}
          userName={userName}
          roleName={session.role.name}
          onAccount={handleAccount}
          onLogout={onLogout}
          onNavigate={handleNavigate}
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
              <ScreenError
                error={err}
                reference={reference}
                onRetry={reset}
                onHome={() => handleNavigate('dashboard')}
              />
            )}
          >
            <Suspense fallback={<ScreenLoading />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      <SidebarDrawer
        open={navOpen && sidebarMode !== 'full'}
        onClose={() => setNavOpen(false)}
        label="Hospital navigation"
      >
        {sidebar('full')}
      </SidebarDrawer>
      <IdleWarningModal
        open={idle.warning}
        secondsLeft={idle.secondsLeft}
        minutes={DEFAULT_IDLE_MINUTES}
        onStay={idle.stayActive}
        onSignOut={onLogout}
      />
    </div>
  );
}
