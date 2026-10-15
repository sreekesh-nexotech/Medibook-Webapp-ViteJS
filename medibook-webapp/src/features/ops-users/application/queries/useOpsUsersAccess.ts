import { useSessionQuery } from '@/features/auth/application/queries/useSessionQuery';
import { platformSessionOf } from '@/features/auth/application/store/auth.roles';

/** What the signed-in operations user may do on this screen. */
export interface OpsUsersAccess {
  /** `staff.add` — invite new users. */
  readonly canAdd: boolean;
  /** `staff.edit` — change roles, deactivate, reactivate, unlock. */
  readonly canEdit: boolean;
  /** `staff.del` — delete custom roles. */
  readonly canDelete: boolean;
  /** The signed-in user's id, so they are never offered "deactivate yourself". */
  readonly selfUserId: string | null;
  /** Every permission the signed-in user holds — the ceiling for roles they grant (B2, M-07). */
  readonly held: ReadonlySet<string>;
}

/**
 * Staff permissions from the platform session (`GET /platform/me`), the same
 * set the backend enforces — the screen hides what the server would refuse.
 */
export function useOpsUsersAccess(): OpsUsersAccess {
  const { data } = useSessionQuery('platform');
  const session = platformSessionOf(data);
  const held = new Set(session?.permissions ?? []);
  return {
    canAdd: held.has('staff.add'),
    canEdit: held.has('staff.edit'),
    canDelete: held.has('staff.del'),
    selfUserId: session?.user.id ?? null,
    held,
  };
}
