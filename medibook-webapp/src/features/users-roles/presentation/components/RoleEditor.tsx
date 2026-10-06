import { useState } from 'react';

import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Can } from '@/shared/ui/Can';
import { Drawer } from '@/shared/ui/Drawer';
import { Field } from '@/shared/ui/Field';
import { Icon } from '@/shared/ui/Icon';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import type { HospitalRole } from '@/app/router/paths';

import { useUpdateRolePermissionsMutation } from '@/features/users-roles/application/queries/useUpdateRolePermissionsMutation';
import type { PermissionModule } from '@/features/users-roles/domain/entities/usersRoles.types';
import {
  PERM_ACTIONS,
  RBAC_MODULES,
  type ModulePerms,
  type PermsGrid,
  type PermAction,
  type RbacModule,
} from '@/features/users-roles/application/store/rbac.types';
import { accessBuckets } from '@/features/users-roles/presentation/components/access-buckets';
import {
  ACTION_LABEL,
  defaultSignInAs,
} from '@/features/users-roles/presentation/components/access-preview';
import { PermCheck } from '@/features/users-roles/presentation/components/PermCheck';
import { RoleAccessPreview } from '@/features/users-roles/presentation/components/RoleAccessPreview';
import {
  extraPermissionModules,
  failureText,
  gridToPermissionCodes,
  type RoleView,
} from '@/features/users-roles/presentation/components/usersRoles.viewModel';

const PERM_COLS: readonly (readonly [PermAction, string])[] = PERM_ACTIONS.map((a) => [
  a,
  ACTION_LABEL[a],
]);

interface RoleEditorProps {
  role: RoleView;
  /** The backend permission catalogue; modules outside the grid are listed under it. */
  catalogue: readonly PermissionModule[];
  onClose: () => void;
}

/**
 * Role editor drawer (design `Rbac.jsx` `RoleEditor`): the role's name, the
 * full module x action permission grid (row-toggle by clicking the module
 * name), the locked notice for the admin role, and the live access preview.
 *
 * A hospital has exactly four system roles (backend Q60) — there is no
 * create, rename or delete — so name and description are read-only and only
 * the grid is saved (`PATCH /roles/{code}/permissions`). That call replaces
 * the whole set, so `gridToPermissionCodes` carries over the codes of the
 * modules this grid does not show. Audit 3.4.1 rides along: the grid sits in a
 * labelled, focusable scroll region instead of crushing below desktop width.
 *
 * The drawer is mounted only while open (the screen renders it conditionally),
 * so its grid starts from the role it was opened with — no prop-into-state
 * effect, and none of the cascading renders that pattern causes.
 */
export function RoleEditor({ role, catalogue, onClose }: RoleEditorProps) {
  const savePermissions = useUpdateRolePermissionsMutation();

  const locked = !role.editable;

  const [perms, setPerms] = useState<PermsGrid>(role.perms);
  const extraModules = extraPermissionModules(catalogue);
  // Codes for the modules outside the grid (e.g. `cash_desk.view`), editable below it.
  const [extra, setExtra] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        role.permissionCodes.filter((c) => extraModules.some((m) => c.startsWith(`${m.module}.`))),
      ),
  );
  const toggleExtra = (code: string): void => {
    if (locked) return;
    setExtra((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };
  const [signInAs, setSignInAs] = useState<HospitalRole>(defaultSignInAs(role));

  const handleSave = (): void =>
    savePermissions.mutate(
      {
        roleCode: role.code,
        // The grid's codes plus the extra modules as edited; any module the
        // catalogue did not list (catalogue unavailable) is carried over.
        permissions: gridToPermissionCodes(
          perms,
          extraModules.length > 0 ? [...extra] : role.permissionCodes,
        ),
      },
      {
        onSuccess: () => {
          toast(`${role.name} permissions updated`, 'success');
          onClose();
        },
        onError: (failure) => toast(failureText(failure, 'Could not save the role.'), 'error'),
      },
    );

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

  const title = locked ? `${role.name} (System)` : `Edit ${role.name}`;

  return (
    <Drawer
      open
      onClose={onClose}
      title={title}
      subtitle="Choose what this role can do in each module"
      width={560}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <span className="flex-1" />
          {!locked && (
            <Can perm="Users & Roles.edit">
              <Button icon="check" onClick={handleSave} busy={savePermissions.isPending}>
                Save Role
              </Button>
            </Can>
          )}
        </>
      }
    >
      <div className="mb-5 grid grid-cols-2 gap-x-4.5 gap-y-4">
        <Field label="Role Name" hint="Hospital roles are fixed">
          <TextInput value={role.name} disabled />
        </Field>
        <Field label="Description">
          <TextInput value={role.desc} disabled />
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
              {extraModules.map((m) => (
                <tr key={m.module}>
                  <td className="border-border-soft text-text-strong text-body border-b px-3 py-2.5 align-middle font-medium whitespace-nowrap">
                    {m.label}
                  </td>
                  {PERM_ACTIONS.map((a) => {
                    const code = `${m.module}.${a}`;
                    return (
                      <td
                        key={a}
                        className="border-border-soft border-b px-2 py-2.5 text-center align-middle"
                      >
                        {m.actions.includes(a) ? (
                          <PermCheck
                            on={extra.has(code)}
                            label={`${ACTION_LABEL[a]} on ${m.label}`}
                            disabled={locked}
                            onClick={() => toggleExtra(code)}
                          />
                        ) : null}
                      </td>
                    );
                  })}
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
            roleName={role.name}
            roleColor={role.color}
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
