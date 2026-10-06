import { useState } from 'react';

import { isFailure } from '@/core/error/failure';

import { useChangeOpsStaffRoleMutation } from '@/features/ops-users/application/queries/useChangeOpsStaffRoleMutation';
import { useInviteOpsStaffMutation } from '@/features/ops-users/application/queries/useInviteOpsStaffMutation';
import type {
  OpsStaffMember,
  OpsStaffRole,
} from '@/features/ops-users/domain/entities/opsUsers.types';
import { email as vEmail, required } from '@/shared/lib/validate';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { OpsField } from '@/shared/ui/OpsField';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import type { CatalogueModule } from './opsUsers.display';
import { OpsRoleAnnotation } from './OpsRoleAnnotation';

/** The role a brand-new invite starts on (narrowest useful profile), when it exists. */
const DEFAULT_NEW_ROLE_CODE = 'support';

interface AddUserErrors {
  name?: string | null;
  email?: string | null;
}

interface UserForm {
  readonly name: string;
  readonly email: string;
  readonly roleId: string;
}

interface AddOpsUserModalProps {
  open: boolean;
  /** The user being edited, or null/omitted to invite a new one. */
  user?: OpsStaffMember | null;
  /** Assignable roles (`GET /platform/roles`). */
  roles: readonly OpsStaffRole[];
  /** The permission catalogue by module, for the role annotation. */
  modules: readonly CatalogueModule[];
  onClose: () => void;
  onDone: () => void;
}

/** The form this modal opens on — an empty invite, or the user being edited. */
function initialForm(
  user: OpsStaffMember | null | undefined,
  roles: readonly OpsStaffRole[],
): UserForm {
  if (user) return { name: user.name, email: user.email, roleId: user.role.id };
  const role = roles.find((r) => r.code === DEFAULT_NEW_ROLE_CODE) ?? roles[0];
  return { name: '', email: '', roleId: role?.id ?? '' };
}

/** "Kavya Reddy" → first "Kavya", last "Reddy"; a single word has no last name. */
function splitName(full: string): { firstName: string; lastName: string | null } {
  const [firstName = '', ...rest] = full.trim().split(/\s+/);
  return { firstName, lastName: rest.length ? rest.join(' ') : null };
}

/**
 * Add / edit an internal Medibook user — a validated form with a live role
 * annotation. Adding invites them (`POST /platform/staff`); editing changes
 * only the role (`PATCH /platform/staff/{id}`), the one field the backend
 * lets an admin change, so name and email are shown read-only.
 *
 * State is initialised from props instead of synced in an effect: the screen
 * keys this component by which user is open, so React remounts it with a
 * fresh form (no `set-state-in-effect`, no stale first render). Built on
 * `FormModal`, so Enter submits (audit 3.4.5).
 */
export function AddOpsUserModal({
  open,
  user,
  roles,
  modules,
  onClose,
  onDone,
}: AddOpsUserModalProps) {
  const invite = useInviteOpsStaffMutation();
  const changeRole = useChangeOpsStaffRoleMutation();
  const [f, setF] = useState<UserForm>(() => initialForm(user, roles));
  const [err, setErr] = useState<AddUserErrors>({});

  const editing = user != null;
  const busy = invite.isPending || changeRole.isPending;
  const role = roles.find((r) => r.id === f.roleId) ?? null;
  const roleChanged = editing && f.roleId !== user.role.id;

  const fail = (failure: unknown) => {
    if (!isFailure(failure)) {
      toast('Could not save this user.', 'error');
      return;
    }
    const fe = failure.fieldErrors;
    const nameErr = fe.first_name?.[0] ?? fe.last_name?.[0] ?? null;
    const emailErr = fe.email?.[0] ?? null;
    if (nameErr || emailErr) setErr({ name: nameErr, email: emailErr });
    toast(fe.role_id?.[0] ?? emailErr ?? nameErr ?? failure.message, 'error');
  };

  const submit = () => {
    if (user) {
      if (!roleChanged) return;
      changeRole.mutate(
        { id: user.id, roleId: f.roleId, version: user.version },
        {
          onSuccess: (saved) => {
            toast(`${saved.name} updated.`);
            onDone();
          },
          onError: fail,
        },
      );
      return;
    }
    const e: AddUserErrors = {
      name: required(f.name, 'Full name'),
      email: vEmail(f.email),
    };
    setErr(e);
    if (e.name || e.email || !f.roleId) return;
    invite.mutate(
      { ...splitName(f.name), email: f.email.trim(), roleId: f.roleId },
      {
        onSuccess: (saved) => {
          toast(`${saved.name} added.`);
          onDone();
        },
        onError: fail,
      },
    );
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit User' : 'Add User'}
      width={460}
      onSubmit={submit}
      submitLabel={busy ? (editing ? 'Saving…' : 'Adding…') : editing ? 'Save User' : 'Add User'}
      busy={busy}
      disabled={editing ? !roleChanged : !f.roleId}
    >
      <div className="flex flex-col gap-4.5">
        <OpsField label="Full Name" required={!editing} error={err.name}>
          <TextInput
            value={f.name}
            name="name"
            autoComplete="off"
            readOnly={editing}
            onChange={(v) => {
              setF({ ...f, name: v });
              setErr({ ...err, name: null });
            }}
            placeholder="e.g. Kavya Reddy"
            height={48}
          />
        </OpsField>
        <OpsField label="Work Email" required={!editing} error={err.email}>
          <TextInput
            value={f.email}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="off"
            readOnly={editing}
            onChange={(v) => {
              setF({ ...f, email: v });
              setErr({ ...err, email: null });
            }}
            placeholder="name@medibook.in"
            height={48}
          />
        </OpsField>
        <OpsField label="Role">
          <Select
            value={role?.name ?? ''}
            options={roles.map((r) => r.name)}
            onChange={(v) =>
              setF({ ...f, roleId: roles.find((r) => r.name === v)?.id ?? f.roleId })
            }
            height={48}
          />
        </OpsField>
        {role && <OpsRoleAnnotation role={role} modules={modules} />}
        <div className="bg-blue-soft-bg text-caption text-text-muted flex items-start gap-2 rounded-sm px-3 py-2.5">
          <Icon name="info" size={14} className="mt-px flex-none" />
          {editing
            ? 'Name and email belong to their own account. Role changes apply from their next request, and are written to Compliance Logs.'
            : 'An invite email is sent. The account stays Pending until they set a password.'}
        </div>
      </div>
    </FormModal>
  );
}
