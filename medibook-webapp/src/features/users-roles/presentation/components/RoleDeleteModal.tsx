import { useState } from 'react';

import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { Select } from '@/shared/ui/Select';
import { toast } from '@/shared/ui/toast/toast.store';

import { roleHolders, useRbacStore } from '@/features/users-roles/application/store/rbac.store';
import type { Role } from '@/features/users-roles/application/store/rbac.types';

interface RoleDeleteModalProps {
  role: Role;
  onClose: () => void;
}

/**
 * Delete-role confirmation — audit 3.6.3, which found two bugs in one place:
 * "deleting a custom role has no confirmation and leaves the users who held it
 * pointing at a role that no longer exists."
 *
 * So this dialog does two things. It names the consequence before anything
 * happens, and when the role still has holders it **requires** the role they
 * move to, showing how many there are and who they are. `rbacDeleteRole`
 * refuses the delete without a valid target, so a confirmation alone can never
 * be enough to orphan a user — the reassignment and the delete are one write.
 */
export function RoleDeleteModal({ role, onClose }: RoleDeleteModalProps) {
  const roles = useRbacStore((s) => s.roles);
  const users = useRbacStore((s) => s.users);
  const rbacDeleteRole = useRbacStore((s) => s.rbacDeleteRole);

  const [moveTo, setMoveTo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const holders = roleHolders(users, role.id);
  const moveTargets = roles.filter((r) => r.id !== role.id);
  const holderWord = holders.length === 1 ? 'user' : 'users';

  const submit = (): void => {
    if (holders.length > 0 && moveTo === '') {
      setError(`Choose the role these ${holders.length} ${holderWord} move to.`);
      return;
    }
    const target = moveTargets.find((r) => r.id === moveTo);
    if (!rbacDeleteRole(role.id, moveTo === '' ? undefined : moveTo)) {
      setError('That role could not be deleted — pick a different role to move the users to.');
      return;
    }
    toast(
      holders.length > 0 && target
        ? `Role deleted · ${holders.length} ${holderWord} moved to ${target.name}`
        : `Role "${role.name}" deleted`,
      'info',
    );
    onClose();
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title={`Delete "${role.name}"?`}
      width={460}
      submitLabel="Delete Role"
      submitVariant="danger"
      onSubmit={submit}
    >
      <p className="text-body-lg text-text-body m-0 mb-3.5">
        Deleting a role is permanent. Anyone holding it loses that role&apos;s access the moment it
        goes.
      </p>
      {holders.length === 0 ? (
        <div className="text-caption text-text-muted bg-bg-subtle border-border-soft rounded-md border px-3.5 py-3">
          No users hold this role, so nothing is reassigned.
        </div>
      ) : (
        <>
          <div className="text-caption text-d-700 bg-d-100 mb-3.5 flex items-start gap-2 rounded-md px-3.5 py-3">
            <Icon name="triangle-alert" size={15} className="mt-px flex-none" />
            <span>
              <b className="font-semibold">
                {holders.length} {holderWord} {holders.length === 1 ? 'holds' : 'hold'} this role
              </b>{' '}
              — {holders.map((u) => u.name).join(', ')}. They must move to another role first, or
              they would be left pointing at a role that no longer exists.
            </span>
          </div>
          <Field label={`Move these ${holderWord} to`} required error={error}>
            <Select
              value={moveTargets.find((r) => r.id === moveTo)?.name ?? ''}
              placeholder="Select a role"
              options={moveTargets.map((r) => r.name)}
              onChange={(name) => {
                setMoveTo(moveTargets.find((r) => r.name === name)?.id ?? '');
                setError(null);
              }}
            />
          </Field>
        </>
      )}
    </FormModal>
  );
}
