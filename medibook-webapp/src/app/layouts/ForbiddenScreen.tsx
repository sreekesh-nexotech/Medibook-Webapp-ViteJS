import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';

import { useHomeTarget } from './useHomeTarget';

interface ForbiddenScreenProps {
  /** The role that *would* be able to open this screen, e.g. "Administrator". */
  requiredRole?: string;
  /** The permission that would be needed, e.g. "Payments.add". */
  requiredPermission?: string;
  /** Override the headline. */
  title?: string;
}

/**
 * Access-denied screen — audit 3.7: `RequireAdmin` used to bounce a
 * receptionist to their dashboard with no explanation, so a role-gated link
 * looked broken rather than restricted. This says *why* the screen did not
 * open and *what access* would open it, which is also what makes the role
 * model demonstrable to a client (audit 2.4 / X-01).
 */
export function ForbiddenScreen({
  requiredRole,
  requiredPermission,
  title = "You don't have access to this screen",
}: ForbiddenScreenProps) {
  const home = useHomeTarget();
  return (
    <div className="flex min-h-105 items-center justify-center p-5">
      <Card pad={32} className="max-w-115 text-center">
        <div className="bg-y-100 text-y-800 mx-auto mb-4 flex size-14 items-center justify-center rounded-lg">
          <Icon name="lock" size={26} />
        </div>
        <div className="text-h2 text-text-strong mb-2">{title}</div>
        <p className="text-body text-text-muted mb-4">
          Your role does not include this module. Ask a hospital administrator to grant it under
          Users &amp; Roles.
        </p>
        {(requiredRole ?? requiredPermission) && (
          <div className="bg-bg-subtle border-border mb-5.5 flex flex-col gap-1 rounded-md border px-4 py-3 text-left">
            {requiredRole && (
              <div className="flex justify-between gap-3">
                <span className="text-caption text-text-muted">Role required</span>
                <span className="text-body text-text-strong font-medium">{requiredRole}</span>
              </div>
            )}
            {requiredPermission && (
              <div className="flex justify-between gap-3">
                <span className="text-caption text-text-muted">Permission required</span>
                <span className="text-body text-text-strong font-medium">{requiredPermission}</span>
              </div>
            )}
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          <Button icon="house" onClick={home.go}>
            {home.label}
          </Button>
        </div>
      </Card>
    </div>
  );
}
