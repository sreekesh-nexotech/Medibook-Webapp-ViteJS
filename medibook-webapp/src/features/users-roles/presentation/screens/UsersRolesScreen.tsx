import { useCallback, useState } from 'react';

import { useCan } from '@/shared/hooks/usePermission';
import { useSort } from '@/shared/hooks/useSort';
import { cn } from '@/shared/lib/cn';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Can } from '@/shared/ui/Can';
import { Card } from '@/shared/ui/Card';
import { ClearChip } from '@/shared/ui/ClearChip';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { ErrorState } from '@/shared/ui/ErrorState';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { Icon } from '@/shared/ui/Icon';
import type { IconName } from '@/shared/ui/icon-registry';
import { IconBtn } from '@/shared/ui/IconBtn';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SearchField } from '@/shared/ui/SearchField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SegTabs } from '@/shared/ui/SegTabs';
import { SkeletonCards, SkeletonKpiStrip } from '@/shared/ui/Skeleton';
import { tdClass, TableShell } from '@/shared/ui/TableShell';
import { toast } from '@/shared/ui/toast/toast.store';
import type { TableStateSpec } from '@/shared/ui/TableState';

import type { HospitalRole } from '@/app/router/paths';

import { roleHolders, useRbacStore } from '@/features/users-roles/application/store/rbac.store';
import {
  PERM_ACTIONS,
  RBAC_MODULES,
  type HospitalUser,
  type PermsGrid,
  type Role,
} from '@/features/users-roles/application/store/rbac.types';
import { defaultSignInAs } from '@/features/users-roles/presentation/components/access-preview';
import { AddUserModal } from '@/features/users-roles/presentation/components/AddUserModal';
import { ResetModal } from '@/features/users-roles/presentation/components/ResetModal';
import { RoleAccessPreview } from '@/features/users-roles/presentation/components/RoleAccessPreview';
import { RoleDeleteModal } from '@/features/users-roles/presentation/components/RoleDeleteModal';
import { RoleEditor } from '@/features/users-roles/presentation/components/RoleEditor';
import { UserDrawer } from '@/features/users-roles/presentation/components/UserDrawer';

/** Module coverage summary for a role card (design `permSummary`). */
function permSummary(perms: PermsGrid): { count: number; full: number } {
  const mods = RBAC_MODULES.filter((m) => PERM_ACTIONS.some((a) => perms[m][a]));
  const full = RBAC_MODULES.filter((m) => PERM_ACTIONS.every((a) => perms[m][a]));
  return { count: mods.length, full: full.length };
}

interface Kpi {
  readonly icon: IconName;
  readonly label: string;
  readonly value: number;
  readonly fg: string;
  readonly bg: string;
}

const TABS = ['Users', 'Roles & Permissions', 'Access Preview'] as const;

const ALL_ROLES = 'All Roles';
const ALL_STATUS = 'All Status';

const USER_COLUMNS = ['User', 'Username', 'Role', 'Last Active', 'Status', 'Action'] as const;

const USER_SORT_KEYS: Readonly<Record<string, string | undefined>> = {
  User: 'name',
  Username: 'username',
  Role: 'role',
  Status: 'status',
};

/** Which drawer/modal the screen currently has open. */
type RoleEditTarget = { readonly role: Role | null } | null;

/**
 * Users & Roles (hospital RBAC), admin-only. A Users / Roles & Permissions /
 * Access Preview segmented view: users get KPI tiles, search + role/status
 * filters, a sortable table with loading, empty and integrity-error states, a
 * detail drawer and an add-user modal; roles get a card grid with live
 * permission summaries plus the role editor drawer. Design `Rbac.jsx`.
 *
 * The third tab is the demonstrable half of audit 2.4 / X-01 / Q-03: pick any
 * role in the RBAC grid — including `Accountant` and `Department Front Desk`,
 * which the topbar role switcher cannot reach — and see the sidebar it gets,
 * the actions it holds and the screens it is refused, computed from the same
 * nav model and permission grid the live sidebar and route guards use.
 */
export function UsersRolesScreen() {
  const roles = useRbacStore((s) => s.roles);
  const users = useRbacStore((s) => s.users);
  const rbacUpdateUser = useRbacStore((s) => s.rbacUpdateUser);
  const canAddUser = useCan('Users & Roles.add');

  const [tab, setTab] = useState<string>(TABS[0]);
  const [add, setAdd] = useState(false);
  const [roleEdit, setRoleEdit] = useState<RoleEditTarget>(null);
  const [userView, setUserView] = useState<HospitalUser | null>(null);
  const [reset, setReset] = useState<HospitalUser | null>(null);
  const [deactivate, setDeactivate] = useState<HospitalUser | null>(null);
  const [roleDelete, setRoleDelete] = useState<Role | null>(null);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState(ALL_ROLES);
  const [statusFilter, setStatusFilter] = useState(ALL_STATUS);
  const [loading, setLoading] = useState(false);
  const [previewRoleId, setPreviewRoleId] = useState(roles[0]?.id ?? '');
  const [signInAs, setSignInAs] = useState<HospitalRole | null>(null);

  /**
   * Re-derive the screen from the store. There is no users API yet, so the
   * refresh re-emits the live store state — every row, KPI and role card is
   * rebuilt from it — and this is where the refetch goes when that API lands.
   */
  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    useRbacStore.setState((s) => ({ roles: [...s.roles], users: [...s.users] }));
    setLoading(false);
  }, []);

  const roleById = Object.fromEntries(roles.map((r) => [r.id, r] as const));
  const { sort, onSort, sorted } = useSort<HospitalUser>();

  const shown = users.filter((u) => {
    if (q && !(u.name + u.email + u.username).toLowerCase().includes(q.toLowerCase())) return false;
    if (roleFilter !== ALL_ROLES && roleById[u.roleId]?.name !== roleFilter) return false;
    if (statusFilter !== ALL_STATUS && u.status !== statusFilter) return false;
    return true;
  });

  // Referential integrity: a user must always point at a role that exists.
  // `rbacDeleteRole` refuses to orphan holders, so this should be impossible —
  // if it ever happens the screen says so instead of rendering a blank cell.
  const orphaned = users.filter((u) => !roleById[u.roleId]);

  const kpis: readonly Kpi[] = [
    {
      icon: 'users',
      label: 'Total Users',
      value: users.length,
      fg: 'text-blue',
      bg: 'bg-blue-soft-bg',
    },
    {
      icon: 'user-check',
      label: 'Active',
      value: users.filter((u) => u.status === 'Active').length,
      fg: 'text-g-600',
      bg: 'bg-g-100',
    },
    { icon: 'shield', label: 'Roles', value: roles.length, fg: 'text-p-500', bg: 'bg-p-100' },
    {
      icon: 'mail',
      label: 'Pending Invites',
      value: users.filter((u) => u.invite === 'Pending').length,
      fg: 'text-y-600',
      bg: 'bg-y-100',
    },
  ];

  const filtersActive = q !== '' || roleFilter !== ALL_ROLES || statusFilter !== ALL_STATUS;
  const clearFilters = (): void => {
    setQ('');
    setRoleFilter(ALL_ROLES);
    setStatusFilter(ALL_STATUS);
  };

  let tableState: TableStateSpec | undefined;
  if (loading) tableState = { kind: 'loading', rows: 5 };
  else if (shown.length === 0)
    tableState = {
      kind: 'empty',
      icon: 'users',
      title: filtersActive ? 'No users match your filters.' : 'No users yet.',
      message: filtersActive
        ? 'Try a different name, role or status.'
        : canAddUser
          ? 'Add your first staff user to give the front desk access.'
          : 'An administrator has to add the first staff user.',
      // Only offer the way out the role is allowed to take.
      actionLabel: filtersActive ? 'Clear filters' : canAddUser ? 'Add User' : undefined,
      onAction: filtersActive ? clearFilters : canAddUser ? () => setAdd(true) : undefined,
    };

  const previewRole = roles.find((r) => r.id === previewRoleId) ?? roles[0];

  return (
    <div className="flex flex-col gap-5">
      <Card pad={16} className="flex flex-wrap items-center justify-between gap-3">
        <SegTabs tabs={TABS} value={tab} onChange={setTab} />
        <div className="flex items-center gap-2.5">
          <RefreshBtn onRefresh={refresh} title="Refresh users and roles" box={44} />
          {tab === 'Users' ? (
            <Can perm="Users & Roles.add">
              <Button icon="user-plus" onClick={() => setAdd(true)}>
                Add User
              </Button>
            </Can>
          ) : tab === 'Roles & Permissions' ? (
            <Can perm="Users & Roles.add">
              <Button icon="plus" onClick={() => setRoleEdit({ role: null })}>
                Create Role
              </Button>
            </Can>
          ) : null}
        </div>
      </Card>

      {tab === 'Users' ? (
        <>
          {loading ? (
            <SkeletonKpiStrip count={kpis.length} />
          ) : (
            <div className="flex gap-4">
              {kpis.map((k) => (
                <Card key={k.label} pad={18} className="flex-1">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        'flex size-9.5 flex-none items-center justify-center rounded-md',
                        k.bg,
                        k.fg,
                      )}
                    >
                      <Icon name={k.icon} size={20} />
                    </div>
                    <span className="text-body text-text-strong font-medium">{k.label}</span>
                  </div>
                  <div className={cn('text-stat mt-2.5', k.fg)}>{k.value}</div>
                </Card>
              ))}
            </div>
          )}
          <Card pad={20}>
            <div className="mb-4">
              <SearchField
                value={q}
                onChange={setQ}
                placeholder="Search users by name, email or username"
              />
            </div>
            <div className="mb-4.5 flex flex-wrap items-center gap-3">
              <FilterSelect
                value={roleFilter}
                options={[ALL_ROLES, ...roles.map((r) => r.name)]}
                onChange={setRoleFilter}
                aria-label="Filter users by role"
              />
              <FilterSelect
                value={statusFilter}
                options={[ALL_STATUS, 'Active', 'Inactive']}
                onChange={setStatusFilter}
                aria-label="Filter users by status"
              />
              {filtersActive && <ClearChip onClick={clearFilters} />}
              <span className="flex-1" />
              <span className="text-caption text-text-muted tabular-nums">
                {shown.length} of {users.length} users
              </span>
            </div>
            {orphaned.length > 0 && (
              <ErrorState
                inline
                title="Some users have no role"
                message={`${orphaned.map((u) => u.name).join(', ')} point at a role that no longer exists. Reassign them from the role editor.`}
                onRetry={refresh}
              />
            )}
            <TableShell
              columns={USER_COLUMNS}
              sortKeys={USER_SORT_KEYS}
              sort={sort}
              onSort={onSort}
              state={tableState}
              scrollLabel="Hospital users"
            >
              {sorted(shown, {
                name: (u) => u.name,
                username: (u) => u.username,
                role: (u) => roleById[u.roleId]?.name,
                status: (u) => u.status,
              }).map((u) => {
                const r = roleById[u.roleId];
                return (
                  <tr
                    key={u.id}
                    onClick={() => setUserView(u)}
                    className="hover:bg-grey-200 cursor-pointer transition-colors duration-150"
                  >
                    <td className={tdClass}>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={u.name} size={32} />
                        <div>
                          <div className="text-body text-text-strong font-medium">{u.name}</div>
                          <div className="text-caption text-text-muted">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className={cn(tdClass, 'text-text-muted')}>{u.username}</td>
                    <td className={tdClass}>
                      {r ? (
                        <span
                          className="text-body inline-flex items-center gap-1.75 font-semibold"
                          style={{ color: r.color }}
                        >
                          <span className="size-2 rounded-full" style={{ background: r.color }} />
                          {r.name}
                        </span>
                      ) : (
                        <span className="text-body text-d-700 font-medium">Role missing</span>
                      )}
                    </td>
                    <td className={cn(tdClass, 'text-text-muted')}>{u.last}</td>
                    <td className={tdClass}>
                      <Badge status={u.status} />
                    </td>
                    <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <IconBtn
                          name="eye"
                          label="View user"
                          box={34}
                          size={15}
                          title={`View ${u.name}`}
                          onClick={() => setUserView(u)}
                        />
                        <Can perm="Users & Roles.edit" disableInstead>
                          <IconBtn
                            name="key-round"
                            label="Reset password"
                            box={34}
                            size={15}
                            title={`Reset password for ${u.name}`}
                            onClick={() => setReset(u)}
                          />
                        </Can>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </TableShell>
          </Card>
        </>
      ) : tab === 'Roles & Permissions' ? (
        loading ? (
          <SkeletonCards count={3} lines={4} />
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {roles.map((r) => {
              const s = permSummary(r.perms);
              const count = roleHolders(users, r.id).length;
              return (
                <Card key={r.id} pad={18} hover onClick={() => setRoleEdit({ role: r })}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="size-2.5 rounded-[3px]" style={{ background: r.color }} />
                    <span className="text-body text-text-strong font-medium">{r.name}</span>
                    {r.system ? (
                      <span className="text-caption text-text-muted ml-auto inline-flex items-center gap-1">
                        <Icon name="lock" size={12} /> System
                      </span>
                    ) : (
                      <Icon name="pencil" size={15} className="text-text-faint ml-auto" />
                    )}
                  </div>
                  <p className="text-caption text-text-muted mb-3 min-h-10">{r.desc}</p>
                  <div className="text-caption text-text-body flex gap-4">
                    <span className="inline-flex items-center gap-1.25">
                      <Icon name="users" size={14} className="text-text-muted" /> {count}{' '}
                      {count === 1 ? 'user' : 'users'}
                    </span>
                    <span className="inline-flex items-center gap-1.25">
                      <Icon name="shield-check" size={14} className="text-text-muted" /> {s.count}/
                      {RBAC_MODULES.length} modules
                    </span>
                  </div>
                </Card>
              );
            })}
            <Can perm="Users & Roles.add">
              <Card
                pad={18}
                hover
                onClick={() => setRoleEdit({ role: null })}
                className="border-border text-text-muted flex min-h-30 flex-col items-center justify-center gap-2 border-[1.5px] border-dashed"
              >
                <Icon name="plus" size={24} />
                <span className="text-body font-medium">Create Role</span>
              </Card>
            </Can>
          </div>
        )
      ) : (
        <Card pad={20}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <SectionTitle size={16}>View as role</SectionTitle>
              <div className="text-caption text-text-muted mt-1">
                Pick any role in the grid — including ones the topbar switcher cannot sign in as —
                and see exactly what it reaches. Driven by the same nav model and permission grid as
                the live sidebar and route guards.
              </div>
            </div>
            <FilterSelect
              value={previewRole?.name ?? ''}
              options={roles.map((r) => r.name)}
              onChange={(name) => {
                const next = roles.find((r) => r.name === name);
                setPreviewRoleId(next?.id ?? '');
                setSignInAs(null);
              }}
              aria-label="Preview access for this role"
            />
          </div>
          {previewRole ? (
            <RoleAccessPreview
              roleName={previewRole.name}
              roleColor={previewRole.color}
              perms={previewRole.perms}
              signInAs={signInAs ?? defaultSignInAs(previewRole)}
              onSignInAsChange={setSignInAs}
            />
          ) : (
            <ErrorState
              inline
              title="No roles to preview"
              message="Create a role first, then come back to see what it reaches."
              onRetry={refresh}
            />
          )}
          <div className="border-border-soft mt-4 border-t pt-3">
            <div className="text-caption text-grey-900">
              Holders of this role:{' '}
              {previewRole && roleHolders(users, previewRole.id).length > 0
                ? roleHolders(users, previewRole.id)
                    .map((u) => u.name)
                    .join(', ')
                : 'nobody yet'}
              .
            </div>
          </div>
        </Card>
      )}

      {add && <AddUserModal roles={roles} onClose={() => setAdd(false)} />}
      {roleEdit && (
        <RoleEditor
          role={roleEdit.role}
          onClose={() => setRoleEdit(null)}
          onRequestDelete={(r) => {
            setRoleEdit(null);
            setRoleDelete(r);
          }}
        />
      )}
      {roleDelete && <RoleDeleteModal role={roleDelete} onClose={() => setRoleDelete(null)} />}
      {userView && (
        <UserDrawer
          user={userView}
          roles={roles}
          onClose={() => setUserView(null)}
          onReset={(u) => {
            setUserView(null);
            setReset(u);
          }}
          onDeactivate={(u) => {
            setUserView(null);
            setDeactivate(u);
          }}
        />
      )}
      {reset && <ResetModal user={reset} onClose={() => setReset(null)} />}
      {deactivate && (
        <ConfirmModal
          open
          danger
          title={`Deactivate ${deactivate.name}?`}
          confirmLabel="Deactivate User"
          body={
            <>
              {deactivate.name} loses access to mbAdmin <b>immediately</b> — any session they have
              open ends, and they cannot sign in again until an administrator reactivates them.
              Their appointments, payments and audit history are kept.
            </>
          }
          onClose={() => setDeactivate(null)}
          onConfirm={() => {
            rbacUpdateUser(deactivate.id, { status: 'Inactive' });
            toast(`${deactivate.name} deactivated — they can no longer sign in`, 'info');
            setDeactivate(null);
          }}
        />
      )}
    </div>
  );
}
