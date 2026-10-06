import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { AuthSurface } from '@/features/auth/domain/entities/auth.types';
import { logoutStaff } from '@/features/auth/application/usecases/logoutStaff';

/**
 * Log out of `surface`: revoke the session, forget the tokens, drop every
 * cached query and mark the auth store signed out. The caller then replaces
 * the route with the login screen. Never fails — local sign-out always happens.
 */
export function useLogoutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (surface: AuthSurface) => unwrap(await logoutStaff(surface)),
    // Run offline too: TanStack pauses mutations while the browser is offline,
    // which would leave a shared desk signed in (SEC-14).
    networkMode: 'always',
    onSettled: () => {
      queryClient.clear();
    },
  });
}
