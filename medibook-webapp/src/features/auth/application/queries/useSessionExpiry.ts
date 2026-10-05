import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { onSessionExpired } from '@/core/api/tokens';

import type { AuthSurface } from '@/features/auth/domain/entities/auth.types';
import { clearAuthStore } from '@/features/auth/application/store/auth.roles';

/**
 * Run `onExpired` when the server refuses `surface`'s refresh token (revoked,
 * rotated out, expired): the tokens are already gone, so this drops the query
 * cache, marks the auth store signed out and lets the caller redirect.
 */
export function useSessionExpiry(surface: AuthSurface, onExpired: () => void) {
  const queryClient = useQueryClient();
  useEffect(
    () =>
      onSessionExpired((expired) => {
        if (expired !== surface) return;
        queryClient.clear();
        clearAuthStore();
        onExpired();
      }),
    [surface, onExpired, queryClient],
  );
}
