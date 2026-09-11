import { useState } from 'react';

import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { cn } from '@/shared/lib/cn';
import { minLen } from '@/shared/lib/validate';
import { Button } from '@/shared/ui/Button';
import { Can } from '@/shared/ui/Can';
import { Drawer } from '@/shared/ui/Drawer';
import { Field } from '@/shared/ui/Field';
import { Icon } from '@/shared/ui/Icon';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import type { HospitalRole } from '@/app/router/paths';

import { blankPerms, ROLE_COLORS } from '@/features/users-roles/application/store/rbac.fixtures';
import { useRbacStore } from '@/features/users-roles/application/store/rbac.store';
import {
  PERM_ACTIONS,
  RBAC_MODULES,
  type ModulePerms,
  type PermsGrid,
  type PermAction,
  type RbacModule,
  type Role,
} from '@/features/users-roles/application/store/rbac.types';
import { accessBuckets } from '@/features/users-roles/presentation/components/access-buckets';
import {
  ACTION_LABEL,
  defaultSignInAs,
} from '@/features/users-roles/presentation/components/access-preview';
import { PermCheck } from '@/features/users-roles/presentation/components/PermCheck';
import { RoleAccessPreview } from '@/features/users-roles/presentation/components/RoleAccessPreview';

const PERM_COLS: readonly (readonly [PermAction, string])[] = PERM_ACTIONS.map((a) => [
  a,
  ACTION_LABEL[a],
]);

/** Monotonic counter for new role ids (replaces the prototype's `Date.now()`). */
let roleIdSeq = 0;

/** Shortest role name that still reads as a name. */
const ROLE_NAME_MIN = 3;

interface RoleForm {
  name: string;
  desc: string;
}

/** Module-level so `useForm`'s error memo stays stable across renders. */
const ROLE_VALIDATORS: FormValidators<RoleForm> = {
  name: (v) => minLen(v, ROLE_NAME_MIN, 'Role name'),
};

interface RoleEditorProps {
  /** `null` creates a new role. */
  role: Role | null;
  onClose: () => void;
  /**
   * Ask the screen for the delete confirmation. The screen owns that dialog so
   * the drawer can close first — two overlapping dialogs would fight over the
   * focus trap.
   */
  onRequestDelete: (role: Role) => void;
}

/**
 * Role editor drawer (design `Rbac.jsx` `RoleEditor`): name + description, the
 * full module x action permission grid (row-toggle by clicking the module
 * name), the locked system-role notice, and the live access preview.
 *
 * Three audit fixes ride along:
 *   - 3.5.1/3.5.4 — the name is validated inline through `useForm`, not by a
 *     toast that vanishes;
 *   - 3.4.1 — the permission grid sits in a labelled, focusable scroll region
 *     instead of crushing below desktop width;
 *   - 3.6.3 — Delete no longer deletes: it hands the role to
 *     `onRequestDelete`, and `RoleDeleteModal` confirms it and reassigns the
 *     holders (`rbacDeleteRole` refuses to orphan them either way).
 *
 * The drawer is mounted only while open (the screen renders it conditionally),
 * so its form starts from the role it was opened with — no prop-into-state
 * effect, and none of the cascading renders that pattern causes.
 */
export function RoleEditor({ role, onClose, onRequestDelete }: RoleEditorProps) {
  const roles = useRbacStore((s) => s.roles);
  const rbacAddRole = useRbacStore((s) => s.rbacAddRole);
  const rbacUpdateRole = useRbacStore((s) => s.rbacUpdateRole);

  const isNew = !role;
  const locked = Boolean(role?.system);

  const [perms, setPerms] = useState<PermsGrid>(role ? role.perms : blankPerms());
  const [signInAs, setSignInAs] = useState<HospitalRole>(
    role ? defaultSignInAs(role) : 'receptionist',
  );

  const form = useForm<RoleForm>({
    initial: { name: role ? role.name : '', desc: role ? role.desc : '' },
    validate: ROLE_VALIDATORS,
    onSubmit: ({ name, desc }) => {
      if (!role) {
        roleIdSeq += 1;
        rbacAddRole({
          id: `r-new-${roleIdSeq}`,
          name: name.trim(),
          desc: desc.trim(),
          color: ROLE_COLORS[roles.length % ROLE_COLORS.length],
          perms,
        });
        toast(`Role "${name.trim()}" created`, 'success');
      } else {
        rbacUpdateRole(role.id, { name: name.trim(), desc: desc.trim(), perms });
        toast('Role updated', 'success');
      }
      onClose();
    },
  });

  const toggle = (mod: RbacModule, act: PermAction): void => {
    if (locked) return;
    setPerms((p) => {
      const next: Record<RbacModule, ModulePerms> = { ...p };
      next[mod] = { ...p[mod], [act]: !p[mod][act] };
      return next;
    });
  };
  const toggleRow = (mod: RbacModule): void => {
    if (locked) return;
    setPerms((p) => {
      const all = PERM_ACTIONS.every((a) => p[mod][a]);
      const next: Record<RbacModule, ModulePerms> = { ...p };
      next[mod] = { view: !all, add: !all, edit: !all, del: !all };
      return next;
    });
  };

  let title: string;
  if (!role) title = 'Create Role';
  else if (locked) title = `${role.name} (System)`;
  else title = `Edit ${role.name}`;

  const previewName = form.values.name.trim() || (role ? role.name : 'This role');

  return (
    <Drawer
      open
      onClose={onClose}
      title={title}
      subtitle="Name the role and choose what it can do in each module"
      width={560}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {!isNew && !locked && role && (
            <Can perm="Users & Roles.del">
              <Button
                variant="ghost"
                icon="trash-2"
                style={{ color: 'var(--color-d-500)' }}
                onClick={() => onRequestDelete(role)}
              >
                Delete
              </Button>
            </Can>
          )}
          <span className="flex-1" />
          {!locked && (
            <Can perm={isNew ? 'Users & Roles.add' : 'Users & Roles.edit'}>
              <Button icon="check" onClick={form.handleSubmit} busy={form.submitting}>
                {isNew ? 'Create Role' : 'Save Role'}
              </Button>
            </Can>
          )}
        </>
      }
    >
      <div className="mb-5 grid grid-cols-2 gap-x-4.5 gap-y-4">
        <Field label="Role Name" required error={form.errorFor('name')}>
          <TextInput
            value={form.values.name}
            onChange={(v) => form.setField('name', v)}
            onBlur={() => form.blurField('name')}
            placeholder="e.g. Billing Supervisor"
            disabled={locked}
          />
        </Field>
        <Field label="Description" error={form.errorFor('desc')}>
          <TextInput
            value={form.values.desc}
            onChange={(v) => form.setField('desc', v)}
            onBlur={() => form.blurField('desc')}
            placeholder="Short description"
            disabled={locked}
          />
        </Field>
      </div>
      {locked && (
        <div className="text-caption text-text-muted bg-y-100 mb-3.5 flex items-center gap-2 rounded-md px-3 py-2.25">
          <Icon name="lock" size={15} className="text-y-700" /> The Administrator role always has
          full access and can&apos;t be edited.
        </div>
      )}
      <div className="text-body text-text-strong mb-2.5 font-medium">Module Permissions</div>
      <div className="border-border-soft overflow-hidden rounded-md border">
        <div
          role="region"
          aria-label="Module permissions grid"
          tabIndex={0}
          className="w-full overflow-x-auto overscroll-x-contain"
        >
          <table className="w-full border-collapse max-sm:min-w-100">
            <thead>
              <tr>
                <th className="bg-bg-tint text-text-navy text-body border-border-soft border-b px-3 py-2.5 text-left font-semibold whitespace-nowrap">
                  Module
                </th>
                {PERM_COLS.map(([k, l]) => (
                  <th
                    key={k}
                    className="bg-bg-tint text-text-navy text-body border-border-soft border-b px-2 py-2.5 text-center font-semibold whitespace-nowrap"
                  >
                    {l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RBAC_MODULES.map((mod) => (
                <tr key={mod}>
                  <td className="border-border-soft text-text-strong text-body border-b px-3 py-2.5 align-middle font-medium whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleRow(mod)}
                      disabled={locked}
                      aria-label={`Toggle every permission on ${mod}`}
                      className={cn(
                        'border-0 bg-transparent p-0 text-left font-medium',
                        locked ? 'cursor-default' : 'cursor-pointer',
                      )}
                    >
                      {mod}
                    </button>
                  </td>
                  {PERM_ACTIONS.map((a) => (
                    <td
                      key={a}
                      className="border-border-soft border-b px-2 py-2.5 text-center align-middle"
                    >
                      <PermCheck
                        on={perms[mod][a]}
                        label={`${ACTION_LABEL[a]} on ${mod}`}
                        disabled={locked}
                        onClick={() => toggle(mod, a)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {!locked && (
        <div className="text-caption text-text-muted mt-2.5">
          Tip: click a module name to toggle its whole row.
        </div>
      )}
      <div className="border-border-soft bg-bg-subtle mt-4 rounded-md border px-3.5 py-3">
        <div className="text-body text-text-strong mb-2 font-medium">What this role can do</div>
        {accessBuckets(perms).none === RBAC_MODULES.length ? (
          <span className="text-caption text-text-muted">
            Nothing yet — grant at least View on one module.
          </span>
        ) : (
          <RoleAccessPreview
            compact
            roleName={previewName}
            roleColor={role?.color}
            perms={perms}
            signInAs={signInAs}
            onSignInAsChange={setSignInAs}
          />
        )}
        <div className="text-caption text-text-muted mt-2">
          Updates as you toggle permissions. Users see only the modules they can at least view.
        </div>
      </div>
    </Drawer>
  );
}
