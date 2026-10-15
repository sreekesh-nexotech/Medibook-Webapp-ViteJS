import type { Result } from '@/core/error/failure';

import type {
  PermissionModule,
  RolePreview,
  StaffCounter,
  StaffDetailsDraft,
  StaffInvitation,
  StaffInviteDraft,
  StaffMember,
  StaffRole,
  StaffRoleCode,
} from '@/features/users-roles/domain/entities/usersRoles.types';

/** The hospital's staff directory, invitations and role permission grids. */
export interface UsersRolesRepository {
  /** Every staff member of the hospital (all pages). */
  listStaff(): Promise<Result<readonly StaffMember[]>>;
  /** Every invitation not yet accepted — links that still work and lapsed ones (all pages). */
  listPendingInvitations(): Promise<Result<readonly StaffInvitation[]>>;
  /** `idempotencyKey` is one per user intent, so a retried submit is not sent twice. */
  inviteStaff(draft: StaffInviteDraft, idempotencyKey: string): Promise<Result<StaffInvitation>>;
  resendInvitation(invitationId: string): Promise<Result<StaffInvitation>>;
  revokeInvitation(invitationId: string): Promise<Result<StaffInvitation>>;
  /** Ends every session of the staff member at once. */
  deactivateStaff(staffId: string): Promise<Result<StaffMember>>;
  reactivateStaff(staffId: string): Promise<Result<StaffMember>>;
  /** Emails the staff member a password-reset link. */
  sendPasswordReset(staffId: string): Promise<Result<StaffMember>>;
  /** Clears a sign-in lockout. */
  unlockStaff(staffId: string): Promise<Result<StaffMember>>;
  /** Role, employee code, designation and default counter; `version` guards a concurrent edit. */
  updateStaffDetails(
    staffId: string,
    details: StaffDetailsDraft,
    version: number,
  ): Promise<Result<StaffMember>>;
  listCounters(): Promise<Result<readonly StaffCounter[]>>;
  /** The permission catalogue — every module a role can be granted. */
  listPermissionModules(): Promise<Result<readonly PermissionModule[]>>;
  listRoles(): Promise<Result<readonly StaffRole[]>>;
  /** Replaces the role's whole permission set with `permissions` (`version` → `If-Match`). */
  updateRolePermissions(
    roleCode: StaffRoleCode,
    permissions: readonly string[],
    version: number | null,
  ): Promise<Result<StaffRole>>;
  /** The role's one-line description (USR-02); `version` guards a concurrent edit. */
  updateRoleDescription(
    roleCode: StaffRoleCode,
    description: string | null,
    version: number,
  ): Promise<Result<StaffRole>>;
  previewRole(roleCode: StaffRoleCode): Promise<Result<RolePreview>>;
}
