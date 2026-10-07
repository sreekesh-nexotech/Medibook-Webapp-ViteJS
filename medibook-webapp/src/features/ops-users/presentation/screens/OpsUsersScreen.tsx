import { useMemo, useState } from 'react';

import { isFailure } from '@/core/error/failure';

import { useDeactivateOpsStaffMutation } from '@/features/ops-users/application/queries/useDeactivateOpsStaffMutation';
import { useOpsPermissionsQuery } from '@/features/ops-users/application/queries/useOpsPermissionsQuery';
import { useOpsRolesQuery } from '@/features/ops-users/application/queries/useOpsRolesQuery';
import { useOpsStaffQuery } from '@/features/ops-users/application/queries/useOpsStaffQuery';
import { useOpsUsersAccess } from '@/features/ops-users/application/queries/useOpsUsersAccess';
import { useReactivateOpsStaffMutation } from '@/features/ops-users/application/queries/useReactivateOpsStaffMutation';
import { useUnlockOpsStaffMutation } from '@/features/ops-users/application/queries/useUnlockOpsStaffMutation';
import type { OpsStaffMember } from '@/features/ops-users/domain/entities/opsUsers.types';
import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { IconBtn } from '@/shared/ui/IconBtn';
import { OpsConfirm } from '@/shared/ui/OpsConfirm';
import { OpsPerson } from '@/shared/ui/OpsPerson';
import { SearchField } from '@/shared/ui/SearchField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { StatCard, type StatCardData } from '@/shared/ui/StatCard';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { toast } from '@/shared/ui/toast/toast.store';

import { AddOpsUserModal } from '../components/AddOpsUserModal';
import {
  STAFF_STATUS_LABEL,
  actionsLabel,
  catalogueModules,
  isLocked,
  lastActiveLabel,
  moduleAccess,
  roleLook,
  roleReach,
  type ModuleAccess,
} from '../components/opsUsers.display';
import { OpsRoleAnnotation } from '../components/OpsRoleAnnotation';

/** No 2FA column: two-factor sign-in is off by design in this phase (Q64, PRD-05). */
const USER_COLUMNS = ['User', 'Role', 'Last Active', 'Status', 'Action'] as const;

/** Which editor the modal is open on: a new invite, or an existing user. */
type EditorState = { readonly kind: 'new' } | { readonly kind: 'edit'; readonly id: string } | null;

/** The access-changing action awaiting confirmation. */
type PendingAction = { readonly kind: 'deactivate' | 'reactivate'; readonly id: string } | null;

/** Check glyph (full access), em-dash (no access) or the actions held, for one matrix cell. */
function mark(access: ModuleAccess) {
  if (access.kind === 'full') {
    return <Icon name="circle-check" size={17} className="text-g-800" />;
  }
  if (access.kind === 'none') {
    return (
      <span className="text-text-muted" title="No access">
        —
      </span>
    );
  }
  return <span className="text-caption text-text-body">{actionsLabel(access.actions)}</span>;
}

/** Toast a failed mutation with the backend's own message. */
function failToast(failure: unknown, fallback: string) {
  toast(isFailure(failure) ? failure.message : fallback, 'error', failure);
}

/** Internal Medibook users & roles (design `OpsUsers`). */
export function OpsUsersScreen() {
  const staffQuery = useOpsStaffQuery();
  const rolesQuery = useOpsRolesQuery();
  const permissionsQuery = useOpsPermissionsQuery();
  const access = useOpsUsersAccess();
  const deactivate = useDeactivateOpsStaffMutation();
  const reactivate = useReactivateOpsStaffMutation();
  const unlock = useUnlockOpsStaffMutation();
  const [q, setQ] = useState('');
  const [editor, setEditor] = useState<EditorState>(null);
  const [pending, setPending] = useState<PendingAction>(null);

  const users: readonly OpsStaffMember[] = staffQuery.data?.items ?? [];
  const roles = rolesQuery.data ?? [];
  const modules = useMemo(
    () => catalogueModules(permissionsQuery.data ?? []),
    [permissionsQuery.data],
  );

  const ql = q.trim().toLowerCase();
  const filtered = users.filter(
    (u) =>
      !ql ||
      u.name.toLowerCase().includes(ql) ||
      u.email.toLowerCase().includes(ql) ||
      u.role.name.toLowerCase().includes(ql),
  );
  const target = users.find((u) => u.id === pending?.id);
  const editingUser =
    editor?.kind === 'edit' ? (users.find((u) => u.id === editor.id) ?? null) : null;
  /** Remount key for the editor, so its form initialises from props (no sync effect). */
  const editorKey = editor ? (editor.kind === 'edit' ? `edit-${editor.id}` : 'new') : 'closed';
  const ct = (roleId: string) => users.filter((u) => u.role.id === roleId).length;

  const KPIS: readonly StatCardData[] = roles.map((r) => {
    const look = roleLook(r.code);
    return {
      icon: look.icon,
      label: r.name,
      value: staffQuery.data ? ct(r.id) : '—',
      sub: roleReach(r, modules),
      iconClass: look.iconClass,
      valueClass: look.valueClass,
    };
  });

  const tableState: TableStateSpec | undefined = staffQuery.isPending
    ? { kind: 'loading' }
    : staffQuery.isLoadingError
      ? {
          kind: 'error',
          error: staffQuery.error,
          title: "Internal users didn't load",
          message: isFailure(staffQuery.error) ? staffQuery.error.message : undefined,
          onRetry: () => void staffQuery.refetch(),
        }
      : users.length === 0
        ? {
            kind: 'empty',
            icon: 'users',
            title: 'No internal users yet.',
            message: 'Invite a colleague with Add User.',
          }
        : filtered.length === 0
          ? {
              kind: 'empty',
              icon: 'users',
              title: 'No results match your search.',
              message: 'Search matches name, email and role.',
              actionLabel: 'Clear search',
              onAction: () => setQ(''),
            }
          : undefined;

  const rolesError = rolesQuery.isLoadingError || permissionsQuery.isLoadingError;
  const rolesState: TableStateSpec | undefined =
    rolesQuery.isPending || permissionsQuery.isPending
      ? { kind: 'loading', rows: 4 }
      : rolesError
        ? {
            kind: 'error',
            error: rolesQuery.error ?? permissionsQuery.error,
            title: "Role permissions didn't load",
            onRetry: () => {
              void rolesQuery.refetch();
              void permissionsQuery.refetch();
            },
          }
        : modules.length === 0
          ? { kind: 'empty', icon: 'shield-check', title: 'No permissions are defined.' }
          : undefined;

  const doUnlock = (u: OpsStaffMember) =>
    unlock.mutate(u.id, {
      onSuccess: () => toast(`${u.name} can sign in again.`),
      onError: (f) => failToast(f, 'Could not unlock this user.'),
    });

  const confirmPending = () => {
    if (!pending || !target) return;
    const mutation = pending.kind === 'deactivate' ? deactivate : reactivate;
    mutation.mutate(target.id, {
      onSuccess: () => {
        toast(pending.kind === 'deactivate' ? 'User deactivated.' : 'User reactivated.');
        setPending(null);
      },
      onError: (f) => failToast(f, 'Could not change this user.'),
    });
  };
  const confirmBusy = deactivate.isPending || reactivate.isPending;
  const isDeactivating = pending?.kind !== 'reactivate';

  return (
    <div className="flex flex-col gap-5">
      {KPIS.length > 0 && (
        <div className="flex flex-wrap gap-4">
          {KPIS.map((k) => (
            <StatCard key={k.label} k={k} />
          ))}
        </div>
      )}
      <Card pad={14} className="flex items-center gap-4">
        <div className="flex-1">
          <SearchField
            value={q}
            onChange={setQ}
            placeholder="Search name, email or role"
            aria-label="Search internal users by name, email or role"
          />
        </div>
        {access.canAdd && (
          <Button
            icon="plus"
            disabled={roles.length === 0}
            onClick={() => setEditor({ kind: 'new' })}
          >
            Add User
          </Button>
        )}
      </Card>
      <Card>
        <TableShell columns={USER_COLUMNS} scrollLabel="Internal users" state={tableState}>
          {filtered.map((u) => {
            const locked = isLocked(u);
            const isSelf = u.userId === access.selfUserId;
            return (
              <tr key={u.id}>
                <td className={tdClass}>
                  <OpsPerson row={u} />
                </td>
                <td className={tdClass}>{u.role.name}</td>
                <td className={tdClass}>{lastActiveLabel(u.lastLoginAt)}</td>
                <td className={tdClass}>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge status={STAFF_STATUS_LABEL[u.status]} />
                    {locked && <Badge status="Suspended">Locked</Badge>}
                  </div>
                </td>
                <td className={tdClass}>
                  {access.canEdit ? (
                    <div className="flex gap-2">
                      {u.status !== 'deactivated' && (
                        <IconBtn
                          name="pencil"
                          box={36}
                          size={15}
                          label="Edit user"
                          title={`Edit ${u.name}`}
                          onClick={() => setEditor({ kind: 'edit', id: u.id })}
                        />
                      )}
                      {locked && (
                        <IconBtn
                          name="lock"
                          box={36}
                          size={15}
                          label="Unlock sign-in"
                          title={`Unlock ${u.name}`}
                          disabled={unlock.isPending}
                          onClick={() => doUnlock(u)}
                        />
                      )}
                      {u.status === 'deactivated' ? (
                        <IconBtn
                          name="user-check"
                          box={36}
                          size={15}
                          label="Reactivate user"
                          title={`Reactivate ${u.name}`}
                          onClick={() => setPending({ kind: 'reactivate', id: u.id })}
                        />
                      ) : (
                        !isSelf && (
                          <IconBtn
                            name="user-x"
                            box={36}
                            size={15}
                            color="var(--color-d-600)"
                            label="Deactivate user"
                            title={`Deactivate ${u.name}`}
                            onClick={() => setPending({ kind: 'deactivate', id: u.id })}
                          />
                        )
                      )}
                    </div>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </TableShell>
        {staffQuery.data?.hasNext && (
          <div className="text-caption text-text-muted mt-3">
            Showing the first {users.length} of {staffQuery.data.total} users.
          </div>
        )}
      </Card>
      <Card>
        <SectionTitle className="mb-1.5">Role Permissions</SectionTitle>
        <div className="text-caption text-text-muted mb-4">
          Each role grants a set of module permissions — assign the narrowest one that covers the
          job. Patient account detail requires its own permission, separate from the account list.
          Every detail view is written to Compliance Logs.
        </div>
        {!rolesState && (
          <div className="mb-4.5 grid gap-3 lg:grid-cols-2">
            {roles.map((r) => (
              <OpsRoleAnnotation key={r.id} role={r} modules={modules} />
            ))}
          </div>
        )}
        <TableShell
          columns={['Permission', ...roles.map((r) => r.name)]}
          scrollLabel="Role permission matrix"
          state={rolesState}
        >
          {modules.map((m) => (
            <tr key={m.module}>
              <td className="text-body text-text-strong border-border-soft w-2/5 border-b px-3.5 align-middle font-medium">
                {m.label}
              </td>
              {roles.map((r) => (
                <td key={r.id} className={cn(tdClass, 'text-center')}>
                  {mark(moduleAccess(r, m))}
                </td>
              ))}
            </tr>
          ))}
        </TableShell>
      </Card>
      <AddOpsUserModal
        key={editorKey}
        open={editor != null}
        user={editingUser}
        roles={roles}
        modules={modules}
        onClose={() => setEditor(null)}
        onDone={() => {
          setEditor(null);
          setQ('');
        }}
      />
      <OpsConfirm
        open={Boolean(target)}
        onClose={() => setPending(null)}
        icon={isDeactivating ? 'user-x' : 'user-check'}
        tone={isDeactivating ? 'danger' : 'success'}
        title={isDeactivating ? 'Deactivate this user?' : 'Reactivate this user?'}
        body={
          target
            ? isDeactivating
              ? `${target.name} loses access and is signed out everywhere. You can reactivate them later.`
              : `${target.name} gets access again with their ${target.role.name} role.`
            : ''
        }
        confirmLabel={
          confirmBusy
            ? isDeactivating
              ? 'Deactivating…'
              : 'Reactivating…'
            : isDeactivating
              ? 'Deactivate User'
              : 'Reactivate User'
        }
        confirmVariant={isDeactivating ? 'danger' : 'primary'}
        busy={confirmBusy}
        onConfirm={confirmPending}
      />
    </div>
  );
}
