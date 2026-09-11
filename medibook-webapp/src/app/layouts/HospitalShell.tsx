import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';

import {
  AUTH_LOGIN_PATH,
  hospitalDashboardPath,
  hospitalPath,
  hospitalViewFromPath,
  type HospitalRole,
  type HospitalView,
} from '@/app/router/paths';

import { useAuthStore } from '@/features/auth/application/store/auth.store';
import { useSettingsStore } from '@/features/settings/application/store/settings.store';

import { ErrorBoundary } from './ErrorBoundary';
import {
  documentTitleFor,
  NAV_PARENT,
  subFor,
  titleFor,
  viewAllowed,
  type HospitalNavView,
} from './hospital-nav';
import { HospitalSidebar } from './HospitalSidebar';
import { HospitalTopbar } from './HospitalTopbar';
import { ScreenError } from './ScreenError';
import { SidebarDrawer } from './SidebarDrawer';
import { useSidebarMode } from './useSidebarMode';
import { createViewHistory } from './view-history';

/**
 * Module-level visited-view stack (the prototype's `AppShell` histRef);
 * recorded synchronously during render, cleared on logout.
 */
const history = createViewHistory<HospitalView>();

interface HospitalShellProps {
  role: HospitalRole;
}

/** Hospital app frame: sidebar + topbar + per-view error boundary (design `AppShell`). */
export function HospitalShell({ role }: HospitalShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const hospitalName = useSettingsStore((s) => s.settings.name);
  const logout = useAuthStore((s) => s.logout);
  const switchRole = useAuthStore((s) => s.switchRole);

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
          while (prev && !viewAllowed(role, prev.view)) prev = history.pop();
          if (prev) navigate(prev.path);
        }
      : null;

  const handleNavigate = (target: HospitalNavView) => {
    setNavOpen(false);
    navigate(hospitalPath(role, target));
  };

  const handleRoleChange = (next: HospitalRole | '__logout') => {
    if (next === '__logout') {
      logout();
      history.clear();
      navigate(AUTH_LOGIN_PATH);
      return;
    }
    switchRole(next);
    if (viewAllowed(next, view)) {
      // Same view under the new role — swap the URL's role segment.
      navigate(`/${next}${location.pathname.slice(role.length + 1)}`);
    } else {
      navigate(hospitalDashboardPath(next));
    }
  };

  const sidebar = (mode: 'full' | 'rail') => (
    <HospitalSidebar
      active={navActive}
      onNavigate={handleNavigate}
      role={role}
      hospitalName={hospitalName}
      mode={mode}
    />
  );

  return (
    <div className="bg-bg-app flex h-full overflow-hidden">
      {sidebarMode !== 'drawer' && sidebar(sidebarMode)}
      <div className="flex min-w-0 flex-1 flex-col">
        <HospitalTopbar
          title={titleFor(role, view)}
          subtitle={subFor(role, view)}
          onBack={onBack}
          role={role}
          onRoleChange={handleRoleChange}
          onNavigate={handleNavigate}
          onMenu={sidebarMode === 'full' ? undefined : () => setNavOpen(true)}
        />
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5">
          <ErrorBoundary
            key={view}
            fallback={(_err, reset) => (
              <ScreenError onRetry={reset} onHome={() => handleNavigate('dashboard')} />
            )}
          >
            <Outlet />
          </ErrorBoundary>
        </div>
      </div>
      <SidebarDrawer
        open={navOpen && sidebarMode !== 'full'}
        onClose={() => setNavOpen(false)}
        label="Hospital navigation"
      >
        {sidebar('full')}
      </SidebarDrawer>
    </div>
  );
}
