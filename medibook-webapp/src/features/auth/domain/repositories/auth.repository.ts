import type { Result } from '@/core/error/failure';

import type {
  AuthSurface,
  InvitationAcceptance,
  InvitationPreview,
  LoginCredentials,
  StaffSession,
} from '@/features/auth/domain/entities/auth.types';

/** Staff authentication on the hospital and platform surfaces. */
export interface AuthRepository {
  /** Sign in, store the token pair, and return the session it opens. */
  login(surface: AuthSurface, credentials: LoginCredentials): Promise<Result<StaffSession>>;
  /** The current session (`/me`), validating the stored tokens. */
  getSession(surface: AuthSurface): Promise<Result<StaffSession>>;
  /** Revoke this session server-side (best effort) and forget the tokens. */
  logout(surface: AuthSurface): Promise<Result<null>>;
  /** Email a reset link. Always succeeds for a well-formed email (no enumeration). */
  requestPasswordReset(surface: AuthSurface, email: string): Promise<Result<null>>;
  /** Set a new password from an emailed reset token; revokes every session. */
  resetPassword(surface: AuthSurface, token: string, newPassword: string): Promise<Result<null>>;
  previewInvitation(token: string): Promise<Result<InvitationPreview>>;
  /** Accept a hospital invitation, store the token pair, return the new session. */
  acceptInvitation(token: string, input: InvitationAcceptance): Promise<Result<StaffSession>>;
}
