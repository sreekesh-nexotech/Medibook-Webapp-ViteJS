import type { Result } from '@/core/error/failure';

import type {
  RolePreview,
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
  /** Every invitation still waiting to be accepted (all pages). */
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
  /** `version` guards against a concurrent edit. */
  changeStaffRole(
    staffId: string,
    roleCode: StaffRoleCode,
    version: number,
  ): Promise<Result<StaffMember>>;
  listRoles(): Promise<Result<readonly StaffRole[]>>;
  /** Replaces the role's whole permission set with `permissions`. */
  updateRolePermissions(
    roleCode: StaffRoleCode,
    permissions: readonly string[],
  ): Promise<Result<StaffRole>>;
  previewRole(roleCode: StaffRoleCode): Promise<Result<RolePreview>>;
}
