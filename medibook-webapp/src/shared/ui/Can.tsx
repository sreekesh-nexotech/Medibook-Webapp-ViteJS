import type { ReactNode } from 'react';

import { usePermission, type PermissionKey } from '@/shared/hooks/usePermission';

interface CanProps {
  /** Permission key(s) from the RBAC grid, e.g. `"Payments.add"`. */
  perm: PermissionKey | readonly PermissionKey[];
  /** Require every listed key. Default: any one is enough. */
  all?: boolean;
  children?: ReactNode;
  /** Rendered when the role lacks the permission. Default: nothing. */
  fallback?: ReactNode;
  /**
   * Instead of hiding the control, render it dimmed and inert (no mouse,
   * keyboard or assistive-technology activation) with an explanatory `title`. Use this when hiding would be confusing — a row
   * action that exists for other users, say — and hiding otherwise, because a
   * control the role can never use is noise.
   */
  disableInstead?: boolean;
  /** Tooltip for `disableInstead`. */
  disabledTitle?: string;
}

const DEFAULT_DISABLED_TITLE = 'Your role does not have permission for this action';

/**
 * Renders `children` only when the signed-in role holds the permission —
 * audit 2.4 / X-01 / Q-03: "Permissions can be ticked, but no screen ever
 * looks different for a limited role."
 *
 * ```tsx
 * <Can perm="Payments.add"><Button>Record payment</Button></Can>
 * <Can perm="Appointments.del" disableInstead><IconBtn name="trash-2" label="Delete" /></Can>
 * ```
 *
 * Keys come from `usePermission` and are the store's own module names — see
 * that hook's doc comment for the full vocabulary.
 */
export function Can({
  perm,
  all = false,
  children,
  fallback = null,
  disableInstead = false,
  disabledTitle = DEFAULT_DISABLED_TITLE,
}: CanProps) {
  const { canAll, canAny } = usePermission();
  const keys: readonly PermissionKey[] = typeof perm === 'string' ? [perm] : perm;
  const allowed = all ? canAll(...keys) : canAny(...keys);

  if (allowed) return <>{children}</>;
  if (!disableInstead) return <>{fallback}</>;

  // `inert` keeps the control out of reach of the keyboard too, not only the
  // mouse (SEC-11); the outer span still shows the explanation on hover.
  return (
    <span title={disabledTitle} className="inline-flex cursor-not-allowed">
      <span inert className="inline-flex opacity-50">
        {children}
      </span>
    </span>
  );
}
