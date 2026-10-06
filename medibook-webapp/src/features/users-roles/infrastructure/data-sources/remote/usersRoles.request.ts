import type {
  StaffDetailsDraft,
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

/** `PatchedStaffPatchRequest` — role, employee code, designation and default counter. */
export interface StaffRolePatchRequest {
  readonly role_code: StaffRoleCode;
  readonly employee_code: string | null;
  readonly designation: string | null;
  readonly counter_id: string | null;
}

export function toStaffPatchRequest(draft: StaffDetailsDraft): StaffRolePatchRequest {
  return {
    role_code: draft.roleCode,
    employee_code: draft.employeeCode,
    designation: draft.designation,
    counter_id: draft.counterId,
  };
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
