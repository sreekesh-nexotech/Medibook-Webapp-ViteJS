import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { AUTH_LOGIN_PATH } from '@/app/router/paths';

import type { AuthSurface } from '@/features/auth/domain/entities/auth.types';
import { useLogoutMutation } from '@/features/auth/application/queries/useLogoutMutation';
import { useSessionExpiry } from '@/features/auth/application/queries/useSessionExpiry';

/**
 * The two ways out of a signed-in shell, both ending on the login screen via
 * a history *replace* (no back-stack into authed routes):
 * - `logout()` — the user asked: revoke the session, clear tokens and cache;
 * - session expiry — the server refused the refresh token; handled here.
 */
export function useSessionExit(surface: AuthSurface, onExit?: () => void) {
  const navigate = useNavigate();
  const { mutate } = useLogoutMutation();

  const toLogin = useCallback(() => {
    onExit?.();
    navigate(AUTH_LOGIN_PATH, { replace: true });
  }, [navigate, onExit]);

  useSessionExpiry(surface, toLogin);

  const logout = useCallback(() => {
    mutate(surface, { onSettled: toLogin });
  }, [mutate, surface, toLogin]);

  return { logout, toLogin };
}
