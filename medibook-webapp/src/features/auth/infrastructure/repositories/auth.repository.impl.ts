import { revokeSession, takeSession } from '@/core/api/http';
import { clearTokens, setTokens } from '@/core/api/tokens';
import { toTokenGrant } from '@/core/api/tokens.response';
import { attempt } from '@/core/error/attempt';
import type { Result } from '@/core/error/failure';
import { ok } from '@/core/error/failure';

import type { AuthSurface, StaffSession } from '@/features/auth/domain/entities/auth.types';
import type { AuthRepository } from '@/features/auth/domain/repositories/auth.repository';
import {
  getHospitalMe,
  getInvitation,
  getPlatformMe,
  postInvitationAccept,
  postLogin,
  postPasswordForgot,
  postPasswordReset,
} from '@/features/auth/infrastructure/data-sources/remote/auth.api';
import {
  toHospitalSession,
  toInvitationPreview,
  toPlatformSession,
} from '@/features/auth/infrastructure/data-sources/remote/auth.response';

async function fetchSession(surface: AuthSurface): Promise<StaffSession> {
  return surface === 'hospital'
    ? toHospitalSession(await getHospitalMe())
    : toPlatformSession(await getPlatformMe());
}

export const authRepository: AuthRepository = {
  login: (surface, { email, password, remember }) =>
    attempt(async () => {
      // A new sign-in never inherits the previous user's tokens.
      clearTokens(surface);
      const tokens = await postLogin(surface, email.trim(), password);
      setTokens(surface, toTokenGrant(tokens), remember);
      return fetchSession(surface);
    }),

  getSession: (surface) => attempt(() => fetchSession(surface)),

  logout: async (surface): Promise<Result<null>> => {
    // Every tab is signed out before any request (SEC-10, SEC-14); revoking
    // on the server is best effort, so "Log out" logs out whatever it says.
    const session = takeSession(surface);
    await attempt(() => revokeSession(surface, session));
    return ok(null);
  },

  requestPasswordReset: (surface, email) =>
    attempt(async () => {
      await postPasswordForgot(surface, email.trim());
      return null;
    }),

  resetPassword: (surface, token, newPassword) =>
    attempt(async () => {
      await postPasswordReset(surface, token, newPassword);
      return null;
    }),

  previewInvitation: (token) =>
    attempt(async () => toInvitationPreview(await getInvitation(token))),

  acceptInvitation: (token, input) =>
    attempt(async () => {
      clearTokens('hospital');
      const tokens = await postInvitationAccept(token, input);
      setTokens('hospital', toTokenGrant(tokens), false);
      return fetchSession('hospital');
    }),
};
