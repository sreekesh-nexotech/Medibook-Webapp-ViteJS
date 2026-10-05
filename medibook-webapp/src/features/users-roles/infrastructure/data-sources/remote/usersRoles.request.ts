import type {
  StaffInviteDraft,
  StaffRoleCode,
} from '@/features/users-roles/domain/entities/usersRoles.types';

/** `InvitationCreateRequest` — `POST /hospital/staff/invitations`. */
export interface InvitationCreateRequest {
  readonly email: string;
  readonly first_name: string;
  readonly last_name: string | null;
  readonly phone_e164: string | null;
  readonly role_code: StaffRoleCode;
}

/** `PatchedStaffPatchRequest` — only the role is edited from this screen. */
export interface StaffRolePatchRequest {
  readonly role_code: StaffRoleCode;
}

/** `PatchedRolePermissionsPatchRequest` — the full replacement grid. */
export interface RolePermissionsPatchRequest {
  readonly permissions: readonly string[];
}

export function toInvitationCreateRequest(draft: StaffInviteDraft): InvitationCreateRequest {
  return {
    email: draft.email,
    first_name: draft.firstName,
    last_name: draft.lastName,
    phone_e164: draft.phone,
    role_code: draft.roleCode,
  };
}
