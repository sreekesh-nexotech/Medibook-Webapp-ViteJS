import { useSessionQuery } from '@/features/auth/application/queries/useSessionQuery';

/** Banners are platform-curated content, governed by the `settings.*` permissions. */
const BANNER_PERMISSIONS = {
  add: 'settings.add',
  edit: 'settings.edit',
  del: 'settings.del',
} as const;

export interface BannerPermissions {
  readonly canAdd: boolean;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
}

/**
 * What the signed-in ops user may do to banners, from `GET /platform/me` —
 * the same set the backend enforces. Everything is off until the session
 * has loaded.
 */
export function useBannerPermissions(): BannerPermissions {
  const { data: session } = useSessionQuery('platform');
  const held = new Set(session?.surface === 'platform' ? session.permissions : []);
  return {
    canAdd: held.has(BANNER_PERMISSIONS.add),
    canEdit: held.has(BANNER_PERMISSIONS.edit),
    canDelete: held.has(BANNER_PERMISSIONS.del),
  };
}
