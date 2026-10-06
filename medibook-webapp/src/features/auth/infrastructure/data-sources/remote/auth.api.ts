import { apiFor, publicApiFor } from '@/core/api/http';
import type { TokensResponse } from '@/core/api/tokens.response';
import { tokensResponseSchema } from '@/core/api/tokens.response';

import type { AuthSurface, InvitationAcceptance } from '@/features/auth/domain/entities/auth.types';
import type {
  HospitalMeResponse,
  InvitationPreviewResponse,
  PlatformMeResponse,
} from '@/features/auth/infrastructure/data-sources/remote/auth.response';
import {
  hospitalMeResponseSchema,
  invitationPreviewResponseSchema,
  platformMeResponseSchema,
} from '@/features/auth/infrastructure/data-sources/remote/auth.response';

/**
 * Staff auth endpoints. Pre-auth calls go through the credential-free client
 * so a stale token from an earlier session is never sent or rotated.
 */

export async function postLogin(
  surface: AuthSurface,
  email: string,
  password: string,
): Promise<TokensResponse> {
  const response = await publicApiFor(surface).post('/auth/login', { email, password });
  return tokensResponseSchema.parse(response.data);
}

export async function getHospitalMe(): Promise<HospitalMeResponse> {
  const response = await apiFor('hospital').get('/me');
  return hospitalMeResponseSchema.parse(response.data);
}

export async function getPlatformMe(): Promise<PlatformMeResponse> {
  const response = await apiFor('platform').get('/me');
  return platformMeResponseSchema.parse(response.data);
}

export async function postPasswordForgot(surface: AuthSurface, email: string): Promise<void> {
  await publicApiFor(surface).post('/auth/password/forgot', { email });
}

export async function postPasswordReset(
  surface: AuthSurface,
  resetToken: string,
  newPassword: string,
): Promise<void> {
  await publicApiFor(surface).post('/auth/password/reset', {
    reset_token: resetToken,
    new_password: newPassword,
  });
}

export async function getInvitation(token: string): Promise<InvitationPreviewResponse> {
  const response = await publicApiFor('hospital').get(
    `/auth/invitations/${encodeURIComponent(token)}`,
  );
  return invitationPreviewResponseSchema.parse(response.data);
}

export async function postInvitationAccept(
  token: string,
  input: InvitationAcceptance,
): Promise<TokensResponse> {
  const response = await publicApiFor('hospital').post(
    `/auth/invitations/${encodeURIComponent(token)}/accept`,
    {
      password: input.password,
      ...(input.firstName ? { first_name: input.firstName } : {}),
      ...(input.lastName ? { last_name: input.lastName } : {}),
    },
  );
  return tokensResponseSchema.parse(response.data);
}
