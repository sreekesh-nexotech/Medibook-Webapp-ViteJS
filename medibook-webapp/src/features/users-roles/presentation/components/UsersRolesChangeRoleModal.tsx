import { useState } from 'react';

import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Select } from '@/shared/ui/Select';
import { toast } from '@/shared/ui/toast/toast.store';

import { useChangeStaffRoleMutation } from '@/features/users-roles/application/queries/useChangeStaffRoleMutation';
import { AccessSummary } from '@/features/users-roles/presentation/components/AccessSummary';
import {
  failureText,
  type RoleView,
  type UserRow,
} from '@/features/users-roles/presentation/components/usersRoles.viewModel';

interface UsersRolesChangeRoleModalProps {
  user: UserRow;
  roles: readonly RoleView[];
  onClose: () => void;
}

/**
 * Edit a staff member's role — the one detail of a user this screen edits
 * (`PATCH /hospital/staff/{id}` with `If-Match`; name, email and phone belong
 * to the person's own account). The backend refuses a change that would leave
 * the hospital without an active admin, or one made against a stale row, and
 * that refusal is shown as is.
 */
export function UsersRolesChangeRoleModal({
  user,
  roles,
  onClose,
}: UsersRolesChangeRoleModalProps) {
  const changeRole = useChangeStaffRoleMutation();
  const [roleId, setRoleId] = useState(user.roleId);
  const [error, setError] = useState<string | null>(null);

  const picked = roles.find((r) => r.id === roleId);
  const unchanged = roleId === user.roleId;

  const submit = (): void => {
    if (!picked || unchanged) {
      onClose();
      return;
    }
    changeRole.mutate(
      { staffId: user.id, roleCode: picked.code, version: user.version },
      {
        onSuccess: () => {
          toast(`${user.name} is now ${picked.name}`, 'success');
          onClose();
        },
        onError: (failure) => setError(failureText(failure, 'Could not change the role.')),
      },
    );
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title={`Edit ${user.name}`}
      width={460}
      submitLabel="Save Role"
      busy={changeRole.isPending}
      disabled={unchanged}
      onSubmit={submit}
    >
      <Field label="Role" required error={error}>
        <Select
          value={picked?.name ?? ''}
          placeholder="Select role"
          options={roles.map((r) => r.name)}
          onChange={(name) => {
            setRoleId(roles.find((r) => r.name === name)?.id ?? user.roleId);
            setError(null);
          }}
        />
      </Field>
      {picked && (
        <div className="border-border-soft bg-bg-subtle mt-4 rounded-md border px-3.5 py-3">
          <div className="mb-1.5 flex items-center gap-1.75">
            <span className="size-2 flex-none rounded-full" style={{ background: picked.color }} />
            <span className="text-body text-text-strong font-medium">{picked.name}</span>
            <span className="text-caption text-text-muted">— {picked.desc}</span>
          </div>
          <AccessSummary perms={picked.perms} />
        </div>
      )}
      <div className="text-caption text-text-muted mt-2.5">
        Name, email and phone belong to {user.name}&apos;s own account and are edited from My
        Account.
      </div>
    </FormModal>
  );
}
