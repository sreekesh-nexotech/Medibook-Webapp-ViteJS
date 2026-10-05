import { useSessionQuery } from '@/features/auth/application/queries/useSessionQuery';
import { platformSessionOf } from '@/features/auth/application/store/auth.roles';

/** What the signed-in operations user may do on this screen. */
export interface OpsUsersAccess {
  /** `staff.add` — invite new users. */
  readonly canAdd: boolean;
  /** `staff.edit` — change roles, deactivate, reactivate, unlock. */
  readonly canEdit: boolean;
  /** The signed-in user's id, so they are never offered "deactivate yourself". */
  readonly selfUserId: string | null;
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
    selfUserId: session?.user.id ?? null,
  };
}
