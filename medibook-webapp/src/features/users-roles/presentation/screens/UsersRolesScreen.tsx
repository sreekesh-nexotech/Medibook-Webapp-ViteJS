import { useState } from 'react';

import { useNow } from '@/shared/hooks/useNow';
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

import { useDeactivateStaffMutation } from '@/features/users-roles/application/queries/useDeactivateStaffMutation';
import { usePendingInvitationsQuery } from '@/features/users-roles/application/queries/usePendingInvitationsQuery';
import { useRolePreviewQuery } from '@/features/users-roles/application/queries/useRolePreviewQuery';
import { useStaffMembersQuery } from '@/features/users-roles/application/queries/useStaffMembersQuery';
import { useStaffRolesQuery } from '@/features/users-roles/application/queries/useStaffRolesQuery';
import {
  PERM_ACTIONS,
  RBAC_MODULES,
  type PermsGrid,
} from '@/features/users-roles/application/store/rbac.types';
import { defaultSignInAs } from '@/features/users-roles/presentation/components/access-preview';
import { AddUserModal } from '@/features/users-roles/presentation/components/AddUserModal';
import { ResetModal } from '@/features/users-roles/presentation/components/ResetModal';
import { RoleAccessPreview } from '@/features/users-roles/presentation/components/RoleAccessPreview';
import { RoleEditor } from '@/features/users-roles/presentation/components/RoleEditor';
import { UserDrawer } from '@/features/users-roles/presentation/components/UserDrawer';
import { UsersRolesChangeRoleModal } from '@/features/users-roles/presentation/components/UsersRolesChangeRoleModal';
import {
  failureText,
  invitationToRow,
  lastActiveLabel,
  previewToPermsGrid,
  staffToRow,
  toRoleView,
  type RoleView,
  type UserRow,
} from '@/features/users-roles/presentation/components/usersRoles.viewModel';

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

const STATUS_OPTIONS = [ALL_STATUS, 'Active', 'Inactive', 'Pending'] as const;

/** Staff members holding `roleId` (pending invitations hold no role yet). */
function roleHolders(users: readonly UserRow[], roleId: string): readonly UserRow[] {
  return users.filter((u) => u.kind === 'staff' && u.roleId === roleId);
}

/**
 * Users & Roles (hospital RBAC), admin-only. A Users / Roles & Permissions /
 * Access Preview segmented view: users get KPI tiles, search + role/status
 * filters, a sortable table with loading, error and empty states, a detail
 * drawer and an invite-user modal; roles get a card grid with live permission
 * summaries plus the role editor drawer. Design `Rbac.jsx`.
 *
 * Data: `GET /hospital/staff` and `GET /hospital/staff/invitations` (pending
 * invitations are listed as users-to-be), `GET /hospital/roles` — the four
 * fixed system roles, so there is no create or delete — and
 * `GET /hospital/roles/{code}/preview` for the third tab.
 *
 * The third tab is the demonstrable half of audit 2.4 / X-01 / Q-03: pick any
 * role — including `Accountant` and `Department Front Desk`, which the topbar
 * role switcher cannot reach — and see the sidebar it gets, the actions it
 * holds and the screens it is refused, computed from the server's effective
 * access for the role and the same nav model the live sidebar uses.
 */
export function UsersRolesScreen() {
  const canAddUser = useCan('Users & Roles.add');
  const now = useNow();

  const staffQuery = useStaffMembersQuery();
  const invitationsQuery = usePendingInvitationsQuery(canAddUser);
  const rolesQuery = useStaffRolesQuery();
  const deactivateStaff = useDeactivateStaffMutation();

  const [tab, setTab] = useState<string>(TABS[0]);
  const [add, setAdd] = useState(false);
  const [roleEdit, setRoleEdit] = useState<RoleView | null>(null);
  const [userView, setUserView] = useState<UserRow | null>(null);
  const [reset, setReset] = useState<UserRow | null>(null);
  const [deactivate, setDeactivate] = useState<UserRow | null>(null);
  const [roleChange, setRoleChange] = useState<UserRow | null>(null);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState(ALL_ROLES);
  const [statusFilter, setStatusFilter] = useState(ALL_STATUS);
  const [previewRoleId, setPreviewRoleId] = useState<string | null>(null);
  const [signInAs, setSignInAs] = useState<HospitalRole | null>(null);

  const roles: readonly RoleView[] = (rolesQuery.data ?? []).map(toRoleView);
  // Pending invitations first: they are the rows an administrator acts on next.
  const users: readonly UserRow[] = [
    ...(invitationsQuery.data ?? []).map(invitationToRow),
    ...(staffQuery.data ?? []).map(staffToRow),
  ];

  const loading = staffQuery.isLoading || rolesQuery.isLoading || invitationsQuery.isLoading;

  const refresh = async (): Promise<void> => {
    await Promise.all([
      staffQuery.refetch(),
      rolesQuery.refetch(),
      canAddUser ? invitationsQuery.refetch() : Promise.resolve(),
    ]);
  };

  const roleById = Object.fromEntries(roles.map((r) => [r.id, r] as const));
  const { sort, onSort, sorted } = useSort<UserRow>();

  const shown = users.filter((u) => {
    if (q && !(u.name + u.email + u.username).toLowerCase().includes(q.toLowerCase())) return false;
    if (roleFilter !== ALL_ROLES && roleById[u.roleId]?.name !== roleFilter) return false;
    if (statusFilter !== ALL_STATUS && u.status !== statusFilter) return false;
    return true;
  });

  const kpis: readonly Kpi[] = [
    {
      icon: 'users',
      label: 'Total Users',
      value: users.filter((u) => u.kind === 'staff').length,
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
  else if (staffQuery.isLoadingError)
    tableState = {
      kind: 'error',
      title: 'Users could not be loaded',
      message: failureText(staffQuery.error, 'Check your connection and try again.'),
      onRetry: () => void staffQuery.refetch(),
    };
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
  const previewQuery = useRolePreviewQuery(
    tab === TABS[2] && previewRole ? previewRole.code : null,
  );
  const previewPerms: PermsGrid | null = previewQuery.data
    ? previewToPermsGrid(previewQuery.data.modules)
    : null;

  const rolesError = rolesQuery.isLoadingError ? (
    <ErrorState
      inline
      title="Roles could not be loaded"
      message={failureText(rolesQuery.error, 'Check your connection and try again.')}
      onRetry={() => void rolesQuery.refetch()}
    />
  ) : null;

  const handleDeactivate = (user: UserRow): void =>
    deactivateStaff.mutate(user.id, {
      onSuccess: () => {
        toast(`${user.name} deactivated — they can no longer sign in`, 'info');
        setDeactivate(null);
      },
      onError: (failure) => {
        toast(failureText(failure, `Could not deactivate ${user.name}.`), 'error');
        setDeactivate(null);
      },
    });

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
                options={STATUS_OPTIONS}
                onChange={setStatusFilter}
                aria-label="Filter users by status"
              />
              {filtersActive && <ClearChip onClick={clearFilters} />}
              <span className="flex-1" />
              <span className="text-caption text-text-muted tabular-nums">
                {shown.length} of {users.length} users
              </span>
            </div>
            {invitationsQuery.isLoadingError && (
              <ErrorState
                inline
                title="Pending invitations could not be loaded"
                message={failureText(
                  invitationsQuery.error,
                  'Only active and inactive users are shown.',
                )}
                onRetry={() => void invitationsQuery.refetch()}
              />
            )}
            {rolesError}
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
                    key={u.key}
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
                    <td className={cn(tdClass, 'text-text-muted')}>
                      {lastActiveLabel(u.lastLoginAt, now)}
                    </td>
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
                        {u.kind === 'staff' && (
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
                        )}
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
        ) : rolesQuery.isLoadingError ? (
          rolesError
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {roles.map((r) => {
              const s = permSummary(r.perms);
              const count = roleHolders(users, r.id).length;
              return (
                <Card key={r.id} pad={18} hover onClick={() => setRoleEdit(r)}>
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
          {loading || previewQuery.isLoading ? (
            <SkeletonCards count={2} lines={4} />
          ) : rolesQuery.isLoadingError ? (
            rolesError
          ) : !previewRole ? (
            <ErrorState
              inline
              title="No roles to preview"
              message="This hospital has no roles provisioned yet."
              onRetry={() => void rolesQuery.refetch()}
            />
          ) : previewQuery.isLoadingError || !previewPerms ? (
            <ErrorState
              inline
              title={`${previewRole.name} access could not be loaded`}
              message={failureText(previewQuery.error, 'Check your connection and try again.')}
              onRetry={() => void previewQuery.refetch()}
            />
          ) : (
            <RoleAccessPreview
              roleName={previewRole.name}
              roleColor={previewRole.color}
              perms={previewPerms}
              signInAs={signInAs ?? defaultSignInAs({ ...previewRole, perms: previewPerms })}
              onSignInAsChange={setSignInAs}
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
      {roleEdit && <RoleEditor role={roleEdit} onClose={() => setRoleEdit(null)} />}
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
          onEditRole={(u) => {
            setUserView(null);
            setRoleChange(u);
          }}
        />
      )}
      {reset && <ResetModal user={reset} onClose={() => setReset(null)} />}
      {roleChange && (
        <UsersRolesChangeRoleModal
          user={roleChange}
          roles={roles}
          onClose={() => setRoleChange(null)}
        />
      )}
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
          onConfirm={() => handleDeactivate(deactivate)}
        />
      )}
    </div>
  );
}
