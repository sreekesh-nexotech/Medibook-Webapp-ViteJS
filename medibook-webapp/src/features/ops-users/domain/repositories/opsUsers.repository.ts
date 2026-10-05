import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  OpsPermission,
  OpsStaffInvite,
  OpsStaffMember,
  OpsStaffRole,
} from '@/features/ops-users/domain/entities/opsUsers.types';

/** Internal staff, roles and permissions on the platform surface. */
export interface OpsUsersRepository {
  /** The first page of staff (largest page the backend allows). */
  listStaff(): Promise<Result<Page<OpsStaffMember>>>;
  /** Create an invited member; the backend emails them a set-password link. */
  inviteStaff(invite: OpsStaffInvite): Promise<Result<OpsStaffMember>>;
  /** Move a member to another role (optimistic concurrency on `version`). */
  changeStaffRole(id: string, roleId: string, version: number): Promise<Result<OpsStaffMember>>;
  /** Deactivate a member and revoke their sessions. */
  deactivateStaff(id: string): Promise<Result<OpsStaffMember>>;
  reactivateStaff(id: string): Promise<Result<OpsStaffMember>>;
  /** Clear a sign-in lockout. */
  unlockStaff(id: string): Promise<Result<OpsStaffMember>>;
  listRoles(): Promise<Result<readonly OpsStaffRole[]>>;
  listPermissions(): Promise<Result<readonly OpsPermission[]>>;
}
