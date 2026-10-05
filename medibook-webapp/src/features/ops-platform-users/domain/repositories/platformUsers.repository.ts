import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  PlatformUserDetail,
  PlatformUserListParams,
  PlatformUserStatus,
  PlatformUserSummary,
} from '@/features/ops-platform-users/domain/entities/platformUsers.entities';

/** Patient accounts, read and moderated from the ops console. */
export interface PlatformUsersRepository {
  listUsers(params: PlatformUserListParams): Promise<Result<Page<PlatformUserSummary>>>;
  /** How many accounts match `status` (all accounts when `null`). */
  countUsers(status: PlatformUserStatus | null): Promise<Result<number>>;
  getUser(id: string): Promise<Result<PlatformUserDetail>>;
  /** Block the account and revoke every session it has. */
  blockUser(id: string, reason: string): Promise<Result<PlatformUserSummary>>;
  unblockUser(id: string): Promise<Result<PlatformUserSummary>>;
  /** Clear a failed-sign-in lockout. */
  unlockUser(id: string): Promise<Result<PlatformUserSummary>>;
}
