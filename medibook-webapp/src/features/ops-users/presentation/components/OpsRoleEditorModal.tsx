import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { cn } from '@/shared/lib/cn';
import { FormModal } from '@/shared/ui/FormModal';
import { OpsField } from '@/shared/ui/OpsField';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import { useSaveOpsRoleMutation } from '@/features/ops-users/application/queries/useSaveOpsRoleMutation';
import type { OpsStaffRole } from '@/features/ops-users/domain/entities/opsUsers.types';
import {
  actionsLabel,
  type CatalogueModule,
} from '@/features/ops-users/presentation/components/opsUsers.display';
import {
  isGridLocked,
  missingPermissions,
  roleCodeError,
  suggestRoleCode,
  toggleGrant,
} from '@/features/ops-users/presentation/components/opsRoles.rules';

const MODAL_WIDTH = 720;
const NAME_MAX = 100;

interface RoleErrors {
  code?: string | null;
  name?: string | null;
  permissions?: string | null;
}

interface OpsRoleEditorModalProps {
  /** The role being edited, or `null` to create one. */
  role: OpsStaffRole | null;
  roles: readonly OpsStaffRole[];
  modules: readonly CatalogueModule[];
  /** Permissions the signed-in user holds: the most a role they save may grant. */
  held: ReadonlySet<string>;
  onClose: () => void;
}

/**
 * Create or edit a platform role (`POST /platform/roles`, `PATCH
 * /platform/roles/{id}` + `If-Match`). The grid offers every catalogue
 * permission, but only the ones the editor holds can be ticked (B2 ceiling,
 * M-07) and the owner role can only be renamed. Mount it only while open.
 */
export function OpsRoleEditorModal({
  role,
  roles,
  modules,
  held,
  onClose,
}: OpsRoleEditorModalProps) {
  const save = useSaveOpsRoleMutation();
  const editing = role !== null;
  const gridLocked = role !== null && isGridLocked(role);
  const [name, setName] = useState(role?.name ?? '');
  const [code, setCode] = useState(role?.code ?? '');
  const [codeTouched, setCodeTouched] = useState(false);
  const [grid, setGrid] = useState<readonly string[]>(role ? [...role.permissions].sort() : []);
  const [err, setErr] = useState<RoleErrors>({});

  // The grid may already hold codes the editor lacks (a role set up by the owner); those stay
  // ticked and locked, and a save that keeps them is refused by the server — say so up front.
  const beyondCeiling = missingPermissions(grid, held);

  const onName = (v: string): void => {
    setName(v);
    if (!editing && !codeTouched) setCode(suggestRoleCode(v));
    setErr((p) => ({ ...p, name: null, code: null }));
  };

  const fail = (failure: unknown): void => {
    if (!isFailure(failure)) {
      toast('Could not save this role.', 'error');
      return;
    }
    const fe = failure.fieldErrors;
    setErr({
      code: fe.code?.[0] ?? null,
      name: fe.name?.[0] ?? null,
      permissions: fe.permissions?.[0] ?? null,
    });
    const missing = failure.meta.missing;
    toast(
      Array.isArray(missing) && missing.length > 0
        ? `You can only grant permissions you hold yourself. Missing: ${missing.join(', ')}.`
        : failure.message,
      'error',
    );
  };

  const submit = (): void => {
    const e: RoleErrors = {
      name: name.trim() === '' ? 'Give the role a name.' : null,
      code: editing ? null : roleCodeError(code, roles),
      permissions:
        beyondCeiling.length > 0 && !gridLocked
          ? `You do not hold ${beyondCeiling.join(', ')}; untick them or ask an owner.`
          : null,
    };
    setErr(e);
    if (e.name || e.code || e.permissions) return;
    if (role) {
      const renamed = name.trim() !== role.name;
      const regridded = !gridLocked && [...role.permissions].sort().join(',') !== grid.join(',');
      if (!renamed && !regridded) {
        onClose();
        return;
      }
      save.mutate(
        {
          kind: 'update',
          id: role.id,
          version: role.version,
          changes: {
            ...(renamed ? { name: name.trim() } : {}),
            ...(regridded ? { permissions: grid } : {}),
          },
        },
        {
          onSuccess: (saved) => {
            toast(`${saved.name} updated.`, 'success');
            onClose();
          },
          onError: fail,
        },
      );
      return;
    }
    save.mutate(
      { kind: 'create', draft: { code: code.trim(), name: name.trim(), permissions: grid } },
      {
        onSuccess: (saved) => {
          toast(`${saved.name} created. Assign it to people from Users & Roles.`, 'success');
          onClose();
        },
        onError: fail,
      },
    );
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title={editing ? `Edit role — ${role.name}` : 'New role'}
      width={MODAL_WIDTH}
      onSubmit={submit}
      submitLabel={editing ? 'Save Role' : 'Create Role'}
      busy={save.isPending}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <OpsField label="Role name" required error={err.name}>
            <TextInput
              value={name}
              onChange={onName}
              maxLength={NAME_MAX}
              placeholder="e.g. Finance lead"
              height={48}
            />
          </OpsField>
          <OpsField
            label="Code"
            required={!editing}
            error={err.code}
            hint={
              editing ? 'Fixed once the role exists.' : 'Lowercase letters, digits, underscores.'
            }
          >
            <TextInput
              value={code}
              onChange={(v) => {
                setCode(v);
                setCodeTouched(true);
                setErr((p) => ({ ...p, code: null }));
              }}
              readOnly={editing}
              disabled={editing}
              height={48}
            />
          </OpsField>
        </div>
        {gridLocked ? (
          <p className="text-caption text-text-muted bg-blue-soft-bg m-0 rounded-sm px-3 py-2.5">
            The owner role always holds every permission; only its name can change.
          </p>
        ) : (
          <p className="text-caption text-text-muted m-0">
            You can grant only permissions your own role holds. Changes apply to everyone on this
            role at their next request.
          </p>
        )}
        {err.permissions && <span className="text-caption text-d-700">{err.permissions}</span>}
        <div className="border-border-soft overflow-x-auto rounded-md border">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-grey-200">
                <th className="text-caption text-text-muted px-3 py-2 text-left font-medium">
                  Module
                </th>
                {['view', 'add', 'edit', 'del'].map((a) => (
                  <th key={a} className="text-caption text-text-muted px-3 py-2 font-medium">
                    {actionsLabel([a])}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.map((m) => (
                <tr key={m.module} className="border-border-soft border-t">
                  <td className="text-body text-text-strong px-3 py-2 font-medium">{m.label}</td>
                  {['view', 'add', 'edit', 'del'].map((a) => {
                    const permCode = `${m.module}.${a}`;
                    const offered = m.actions.includes(a);
                    const mayGrant = held.has(permCode);
                    const checked = grid.includes(permCode);
                    return (
                      <td key={a} className="px-3 py-2 text-center">
                        {offered ? (
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={gridLocked || (!mayGrant && !checked)}
                            onChange={(e) => {
                              setGrid((g) => toggleGrant(g, permCode, e.target.checked));
                              setErr((p) => ({ ...p, permissions: null }));
                            }}
                            aria-label={`${m.label}: ${actionsLabel([a])}`}
                            title={mayGrant ? undefined : 'Your role does not hold this permission'}
                            className={cn(
                              'accent-blue size-4',
                              gridLocked || !mayGrant ? 'cursor-not-allowed' : 'cursor-pointer',
                            )}
                          />
                        ) : (
                          <span className="text-text-faint">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <span className="text-caption text-text-muted">
          {grid.length} permission{grid.length === 1 ? '' : 's'} selected.
        </span>
      </div>
    </FormModal>
  );
}
