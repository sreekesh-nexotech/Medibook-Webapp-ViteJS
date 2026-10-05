import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { AuthSurface } from '@/features/auth/domain/entities/auth.types';
import { clearAuthStore } from '@/features/auth/application/store/auth.roles';
import { logoutEverywhere } from '@/features/profile/application/usecases/logoutEverywhere';

/**
 * Revoke every session of the user (all devices, both surfaces). On success
 * this browser is signed out too: the cache is dropped and the caller
 * redirects to login.
 */
export function useLogoutEverywhereMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (surface: AuthSurface) => unwrap(await logoutEverywhere(surface)),
    onSuccess: () => {
      queryClient.clear();
      clearAuthStore();
    },
  });
}
