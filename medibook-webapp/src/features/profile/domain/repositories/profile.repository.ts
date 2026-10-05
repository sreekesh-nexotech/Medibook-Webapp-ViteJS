import type { Result } from '@/core/error/failure';

import type { AuthSurface, StaffSession } from '@/features/auth/domain/entities/auth.types';
import type {
  ActiveSession,
  NameChange,
  PasswordChange,
} from '@/features/profile/domain/entities/profile.types';

/** The signed-in staff member's own account. */
export interface ProfileRepository {
  /** Edit the user's own name; `version` guards against a concurrent edit. */
  updateName(
    surface: AuthSurface,
    change: NameChange,
    version: number,
  ): Promise<Result<StaffSession>>;
  /** Change the password; the server revokes every other session. */
  changePassword(surface: AuthSurface, change: PasswordChange): Promise<Result<null>>;
  listSessions(surface: AuthSurface): Promise<Result<readonly ActiveSession[]>>;
  revokeSession(surface: AuthSurface, sessionId: string): Promise<Result<null>>;
  /** Revoke every session of the user, on every surface, then forget local tokens. */
  logoutEverywhere(surface: AuthSurface): Promise<Result<null>>;
}
