import type { ReactNode } from 'react';

import { useOpsPermission, type OpsPermissionKey } from '@/shared/hooks/useOpsPermission';

interface CanOpsProps {
  /** Platform permission code(s), e.g. `"billing.edit"`. */
  perm: OpsPermissionKey | readonly OpsPermissionKey[];
  /** Require every listed code. Default: any one is enough. */
  all?: boolean;
  children?: ReactNode;
  /** Rendered when the role lacks the permission. Default: nothing. */
  fallback?: ReactNode;
}

/**
 * Renders `children` only when the signed-in platform role holds the
 * permission the action's endpoint enforces (SEC-05) — the ops console's
 * counterpart of `Can`, which reads hospital roles.
 *
 * ```tsx
 * <CanOps perm="settlements.edit"><Button>Release payout</Button></CanOps>
 * ```
 */
export function CanOps({ perm, all = false, children, fallback = null }: CanOpsProps) {
  const { canAll, canAny } = useOpsPermission();
  const keys: readonly OpsPermissionKey[] = typeof perm === 'string' ? [perm] : perm;
  return <>{(all ? canAll(...keys) : canAny(...keys)) ? children : fallback}</>;
}
