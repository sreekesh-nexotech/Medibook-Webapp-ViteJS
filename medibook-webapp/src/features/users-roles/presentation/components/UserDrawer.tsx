import type { ReactNode } from 'react';

import { useNow } from '@/shared/hooks/useNow';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Can } from '@/shared/ui/Can';
import { Card } from '@/shared/ui/Card';
import { Drawer } from '@/shared/ui/Drawer';
import { toast } from '@/shared/ui/toast/toast.store';

import { useReactivateStaffMutation } from '@/features/users-roles/application/queries/useReactivateStaffMutation';
import { useResendInvitationMutation } from '@/features/users-roles/application/queries/useResendInvitationMutation';
import { useRevokeInvitationMutation } from '@/features/users-roles/application/queries/useRevokeInvitationMutation';
import { useStaffCountersQuery } from '@/features/users-roles/application/queries/useStaffCountersQuery';
import { useUnlockStaffMutation } from '@/features/users-roles/application/queries/useUnlockStaffMutation';
import { AccessSummary } from '@/features/users-roles/presentation/components/AccessSummary';
import {
  failureText,
  isLockedOut,
  lastActiveLabel,
  NO_VALUE,
  type RoleView,
  type UserRow,
} from '@/features/users-roles/presentation/components/usersRoles.viewModel';

interface UserDrawerProps {
  user: UserRow;
  roles: readonly RoleView[];
  onClose: () => void;
  onReset: (user: UserRow) => void;
  /**
   * Ask the screen for the deactivation confirmation. The screen owns that
   * dialog so the drawer can close first — two overlapping dialogs would fight
   * over the focus trap.
   */
  onDeactivate: (user: UserRow) => void;
  /** Open the role editor for this staff member (same focus-trap reasoning). */
  onEditRole: (user: UserRow) => void;
}

/**
 * User detail drawer (design `Rbac.jsx` `UserDrawer`): identity header with the
 * role annotation, the plain-words access summary, an info card, and the
 * account actions.
 *
 * A row is either a staff member or an invitation not yet accepted:
 *   - staff: reset password (email link), deactivate (confirmed by the screen,
 *     audit 3.6.2) or reactivate, unlock a sign-in lockout, and edit the role;
 *   - invitation: resend the link or revoke it — there is no account yet to
 *     reset or deactivate.
 * Every action is a real request; the toast reports what the server accepted.
 */
export function UserDrawer({
  user,
  roles,
  onClose,
  onReset,
  onDeactivate,
  onEditRole,
}: UserDrawerProps) {
  const now = useNow();
  const reactivate = useReactivateStaffMutation();
  const unlock = useUnlockStaffMutation();
  const resend = useResendInvitationMutation();
  const revoke = useRevokeInvitationMutation();

  const role = roles.find((r) => r.id === user.roleId);
  const active = user.status === 'Active';
  const isInvitation = user.kind === 'invitation';
  const countersQuery = useStaffCountersQuery();
  const counterName = countersQuery.data?.find((c) => c.id === user.counterId)?.name;
  const locked = isLockedOut(user, now);

  const when = (iso: string | null): string =>
    iso
      ? new Date(iso).toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : NO_VALUE;
  const row = (k: string, v: ReactNode) => (
    <div className="border-border-soft flex justify-between border-b py-3">
      <span className="text-body text-text-muted">{k}</span>
      <span className="text-body text-text-strong text-right font-medium">{v}</span>
    </div>
  );

  const handleReactivate = (): void =>
    reactivate.mutate(user.id, {
      onSuccess: () => {
        toast(`${user.name} activated`, 'info');
        onClose();
      },
      onError: (failure) =>
        toast(failureText(failure, `Could not activate ${user.name}.`), 'error'),
    });

  const handleUnlock = (): void =>
    unlock.mutate(user.id, {
      onSuccess: () => toast(`${user.name} unlocked — they can sign in again`, 'success'),
      onError: (failure) => toast(failureText(failure, `Could not unlock ${user.name}.`), 'error'),
    });

  const handleResend = (): void =>
    resend.mutate(user.id, {
      onSuccess: () => toast(`Invitation resent to ${user.email}`, 'success'),
      onError: (failure) =>
        toast(failureText(failure, 'Could not resend the invitation.'), 'error'),
    });

  const handleRevoke = (): void =>
    revoke.mutate(user.id, {
      onSuccess: () => {
        toast(`Invitation for ${user.name} revoked — the link no longer works`, 'info');
        onClose();
      },
      onError: (failure) =>
        toast(failureText(failure, 'Could not revoke the invitation.'), 'error'),
    });

  return (
    <Drawer
      open
      onClose={onClose}
      title={user.name}
      subtitle={user.email}
      width={460}
      footer={
        isInvitation ? (
          <>
            <Can perm="Users & Roles.add">
              <Button
                variant="secondary"
                icon="send"
                onClick={handleResend}
                busy={resend.isPending}
              >
                Resend Invite
              </Button>
            </Can>
            <span className="flex-1" />
            <Can perm="Users & Roles.add">
              <Button
                variant="ghost"
                icon="user-x"
                style={{ color: 'var(--color-d-500)' }}
                onClick={handleRevoke}
                busy={revoke.isPending}
              >
                Revoke Invite
              </Button>
            </Can>
          </>
        ) : (
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
                busy={reactivate.isPending}
                onClick={() => {
                  if (active) {
                    onDeactivate(user);
                    return;
                  }
                  handleReactivate();
                }}
              >
                {active ? 'Deactivate' : 'Activate'}
              </Button>
            </Can>
          </>
        )
      }
    >
      <div className="mb-4.5 flex items-center gap-3.5">
        <Avatar name={user.name} size={56} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-h3 text-text-strong">{user.name}</span>
            <Badge status={user.status === 'Expired' ? 'Cancelled' : user.status}>
              {user.status === 'Expired' ? 'Invite expired' : user.status}
            </Badge>
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
        {row('Email', user.email)}
        {row('Phone', user.phone)}
        {row('Role', role ? role.name : NO_VALUE)}
        {isInvitation ? (
          <>
            {row(
              'Invite status',
              <Badge status={user.status === 'Expired' ? 'Cancelled' : 'Pending'}>
                {user.status === 'Expired' ? 'Link expired' : 'Waiting for them to accept'}
              </Badge>,
            )}
            {row('Invited on', when(user.invitedAt))}
            {row(
              'Last sent',
              `${when(user.lastSentAt)}${user.resendCount > 0 ? ` · resent ${user.resendCount}×` : ''}`,
            )}
            {row(
              user.status === 'Expired' ? 'Link expired on' : 'Link expires',
              when(user.expiresAt),
            )}
          </>
        ) : (
          <>
            {row('Employee code', user.employeeCode ?? NO_VALUE)}
            {row('Designation', user.designation ?? NO_VALUE)}
            {row('Default counter', counterName ?? NO_VALUE)}
            {row('Joined', when(user.joinedAt))}
            {user.deactivatedAt && row('Deactivated on', when(user.deactivatedAt))}
          </>
        )}
        <div className="flex justify-between py-3">
          <span className="text-body text-text-muted">Last active</span>
          <span className="text-body text-text-strong font-medium">
            {lastActiveLabel(user.lastLoginAt, now)}
          </span>
        </div>
      </Card>
      {!isInvitation && (
        <div className="flex gap-2.5">
          <Can perm="Users & Roles.edit" disableInstead>
            <Button
              variant="secondary"
              icon="pencil"
              className="flex-1"
              onClick={() => onEditRole(user)}
            >
              Edit Details
            </Button>
          </Can>
          {locked && (
            <Can perm="Users & Roles.edit">
              <Button
                variant="secondary"
                icon="lock"
                className="flex-1"
                onClick={handleUnlock}
                busy={unlock.isPending}
              >
                Unlock
              </Button>
            </Can>
          )}
        </div>
      )}
      <div className="text-caption text-grey-900 mt-2.5">
        {isInvitation
          ? user.status === 'Expired'
            ? 'This link no longer works. Resend to issue a new one, or revoke it.'
            : 'They become a user once they accept the emailed link. Resending issues a new link; revoking cancels it.'
          : locked
            ? 'Locked out after too many failed sign-ins. Unlock lets them try again now.'
            : 'Edit Details changes their role, employee code, designation and default counter. Name, email and phone belong to their own account.'}
      </div>
    </Drawer>
  );
}
