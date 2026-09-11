import type { ReactNode } from 'react';

import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Can } from '@/shared/ui/Can';
import { Card } from '@/shared/ui/Card';
import { Drawer } from '@/shared/ui/Drawer';
import { toast } from '@/shared/ui/toast/toast.store';

import { useRbacStore } from '@/features/users-roles/application/store/rbac.store';
import type { HospitalUser, Role } from '@/features/users-roles/application/store/rbac.types';
import { AccessSummary } from '@/features/users-roles/presentation/components/AccessSummary';

interface UserDrawerProps {
  user: HospitalUser;
  roles: readonly Role[];
  onClose: () => void;
  onReset: (user: HospitalUser) => void;
  /**
   * Ask the screen for the deactivation confirmation. The screen owns that
   * dialog so the drawer can close first — two overlapping dialogs would fight
   * over the focus trap.
   */
  onDeactivate: (user: HospitalUser) => void;
}

/**
 * User detail drawer (design `Rbac.jsx` `UserDrawer`): identity header with the
 * role annotation, the plain-words access summary, an info card, and the
 * reset-password / activate-deactivate actions.
 *
 * Audit 3.6.2 — "deactivating a hospital staff user fires immediately" — is
 * fixed by handing the action to `onDeactivate`, which the screen answers with
 * a `ConfirmModal` naming the consequence before anything is written.
 * Reactivation is not destructive, so it still applies directly.
 * The two actions that have no implementation behind them (editing details,
 * re-delivering an invite) are disabled and say so, rather than raising a
 * toast for work that did not happen.
 */
export function UserDrawer({ user, roles, onClose, onReset, onDeactivate }: UserDrawerProps) {
  const rbacUpdateUser = useRbacStore((s) => s.rbacUpdateUser);

  const role = roles.find((r) => r.id === user.roleId);
  const active = user.status === 'Active';

  const row = (k: string, v: ReactNode) => (
    <div className="border-border-soft flex justify-between border-b py-3">
      <span className="text-body text-text-muted">{k}</span>
      <span className="text-body text-text-strong text-right font-medium">{v}</span>
    </div>
  );

  return (
    <Drawer
      open
      onClose={onClose}
      title={user.name}
      subtitle={user.email}
      width={460}
      footer={
        <>
          <Can perm="Users & Roles.edit">
            <Button variant="secondary" icon="key-round" onClick={() => onReset(user)}>
              Reset Password
            </Button>
          </Can>
          <span className="flex-1" />
          <Can perm="Users & Roles.edit">
            <Button
              variant={active ? 'ghost' : 'success'}
              icon={active ? 'user-x' : 'user-check'}
              style={active ? { color: 'var(--color-d-500)' } : undefined}
              onClick={() => {
                if (active) {
                  onDeactivate(user);
                  return;
                }
                rbacUpdateUser(user.id, { status: 'Active' });
                toast(`${user.name} activated`, 'info');
                onClose();
              }}
            >
              {active ? 'Deactivate' : 'Activate'}
            </Button>
          </Can>
        </>
      }
    >
      <div className="mb-4.5 flex items-center gap-3.5">
        <Avatar name={user.name} size={56} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-h3 text-text-strong">{user.name}</span>
            <Badge status={user.status} />
          </div>
          {role && (
            <div
              className="text-body mt-1.25 inline-flex items-center gap-1.5 font-semibold"
              style={{ color: role.color }}
            >
              <span className="size-2 rounded-full" style={{ background: role.color }} />
              {role.name}
            </div>
          )}
        </div>
      </div>
      {role && (
        <div className="border-border-soft bg-bg-subtle mb-4 rounded-md border px-3.5 py-3">
          {role.desc && <div className="text-caption text-text-muted mb-2">{role.desc}</div>}
          <AccessSummary perms={role.perms} />
        </div>
      )}
      <Card pad={16} className="mb-4">
        {row('Username', user.username)}
        {row('Email', user.email)}
        {row('Phone', user.phone)}
        {row('Role', role ? role.name : '—')}
        {row(
          'Invite status',
          <Badge status={user.invite === 'Accepted' ? 'Active' : 'Pending'}>{user.invite}</Badge>,
        )}
        <div className="flex justify-between py-3">
          <span className="text-body text-text-muted">Last active</span>
          <span className="text-body text-text-strong font-medium">{user.last}</span>
        </div>
      </Card>
      <div className="flex gap-2.5">
        <Button variant="secondary" icon="pencil" className="flex-1" disabled>
          Edit Details
        </Button>
        {user.invite === 'Pending' && (
          <Button variant="secondary" icon="send" className="flex-1" disabled>
            Resend Invite
          </Button>
        )}
      </div>
      <div className="text-caption text-grey-900 mt-2.5">
        Editing a user&apos;s details and re-sending an invite arrive with the users API. Until
        then, change access through the role editor or a password reset.
      </div>
    </Drawer>
  );
}
