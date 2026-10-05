import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { opsPath } from '@/app/router/paths';
import { isFailure } from '@/core/error/failure';
import { useBlockPlatformUserMutation } from '@/features/ops-platform-users/application/queries/useBlockPlatformUserMutation';
import { usePlatformUserQuery } from '@/features/ops-platform-users/application/queries/usePlatformUserQuery';
import { useUnblockPlatformUserMutation } from '@/features/ops-platform-users/application/queries/useUnblockPlatformUserMutation';
import { useUnlockPlatformUserMutation } from '@/features/ops-platform-users/application/queries/useUnlockPlatformUserMutation';
import type { PlatformUserDetail } from '@/features/ops-platform-users/domain/entities/platformUsers.entities';
import {
  ACCOUNT_STATUS_PILLS,
  NO_VALUE,
  ageFrom,
  bookingStatusPill,
  formatDate,
  formatDateTime,
  fullName,
  humanize,
  isLockedAt,
  userName,
} from '@/features/ops-platform-users/presentation/components/platformUsersFormat';
import { useNow } from '@/shared/hooks/useNow';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { InfoGrid } from '@/shared/ui/InfoGrid';
import type { InfoGridItem } from '@/shared/ui/InfoGrid';
import { OpsConfirm } from '@/shared/ui/OpsConfirm';
import { OpsField } from '@/shared/ui/OpsField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { Spinner } from '@/shared/ui/Spinner';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import { toast } from '@/shared/ui/toast/toast.store';

/** `UserBlockRequest.reason` max length (`schema.yml`). */
const BLOCK_REASON_MAX = 500;

/** Read-only patient-account view (design `OpsPlatformUserDetail`). */
export function OpsPlatformUserDetailScreen() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = usePlatformUserQuery(id);

  if (user.isPending) {
    return (
      <div className="text-text-muted flex justify-center py-16">
        <Spinner size={28} label="Loading the account" />
      </div>
    );
  }
  if (user.isError) {
    const notFound = isFailure(user.error) && user.error.kind === 'notFound';
    return (
      <ErrorState
        title={notFound ? 'This account does not exist' : "This account didn't load"}
        message={
          notFound
            ? 'It may have been removed, or the link is wrong.'
            : isFailure(user.error)
              ? user.error.message
              : undefined
        }
        onRetry={notFound ? undefined : () => void user.refetch()}
      >
        <Button variant="secondary" onClick={() => navigate(opsPath('platform-users'))}>
          Back to Platform Users
        </Button>
      </ErrorState>
    );
  }
  return <PlatformUserDetailBody u={user.data} />;
}

interface PlatformUserDetailBodyProps {
  u: PlatformUserDetail;
}

function PlatformUserDetailBody({ u }: PlatformUserDetailBodyProps) {
  const now = useNow();
  const block = useBlockPlatformUserMutation();
  const unblock = useUnblockPlatformUserMutation();
  const unlock = useUnlockPlatformUserMutation();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [reason, setReason] = useState('');

  const name = userName(u);
  const pill = ACCOUNT_STATUS_PILLS[u.status];
  const blocked = u.status === 'blocked';
  const canModerate = u.status !== 'deleted';
  const locked = isLockedAt(u.lockedUntil, now);
  const family = u.persons.filter((p) => !p.isSelf);
  const busy = block.isPending || unblock.isPending;
  const trimmedReason = reason.trim();

  const closeConfirm = (): void => {
    setIsConfirmOpen(false);
    setReason('');
  };
  const onFailure =
    (fallback: string) =>
    (failure: unknown): void =>
      toast(isFailure(failure) ? failure.message : fallback, 'error');

  const handleConfirm = (): void => {
    if (blocked) {
      unblock.mutate(u.id, {
        onSuccess: () => {
          toast(`${name} unblocked.`);
          closeConfirm();
        },
        onError: onFailure('Could not unblock this account.'),
      });
      return;
    }
    if (!trimmedReason) return;
    block.mutate(
      { id: u.id, reason: trimmedReason },
      {
        onSuccess: () => {
          toast(`${name} blocked.`);
          closeConfirm();
        },
        onError: onFailure('Could not block this account.'),
      },
    );
  };

  const handleUnlock = (): void => {
    unlock.mutate(u.id, {
      onSuccess: () => toast(`${name} can sign in again.`),
      onError: onFailure('Could not unlock sign-in for this account.'),
    });
  };

  const contact = [u.phone, u.email].filter(Boolean).join(' · ');
  const info: InfoGridItem[] = [
    { k: 'Name', v: name },
    { k: 'Mobile', v: u.phone ?? NO_VALUE, num: true },
    { k: 'Email', v: u.email ?? NO_VALUE },
    { k: 'Registered', v: formatDate(u.createdAt) },
    { k: 'Status', v: pill.label },
    { k: 'City', v: NO_VALUE },
  ];
  if (blocked) info.push({ k: 'Blocked reason', v: u.blockedReason ?? NO_VALUE });
  if (locked) info.push({ k: 'Sign-in locked until', v: formatDateTime(u.lockedUntil) });

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={name} size={56} />
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-3">
              <SectionTitle size={20}>{name}</SectionTitle>
              <Badge status={pill.badge}>{pill.label}</Badge>
            </div>
            <span className="text-caption text-text-muted">{contact || NO_VALUE}</span>
          </div>
          <div className="flex-1"></div>
          {locked && (
            <Button
              variant="secondary"
              icon="key-round"
              busy={unlock.isPending}
              onClick={handleUnlock}
            >
              Unlock sign-in
            </Button>
          )}
          {canModerate && (
            <Button
              variant={blocked ? 'secondary' : 'danger'}
              icon={blocked ? 'user-check' : 'ban'}
              onClick={() => setIsConfirmOpen(true)}
            >
              {blocked ? 'Unblock Account' : 'Block Account'}
            </Button>
          )}
        </div>
      </Card>
      <InfoGrid items={info} />
      <Card>
        <SectionTitle className="mb-4">Family Members</SectionTitle>
        {family.length > 0 ? (
          <TableShell
            columns={['Name', 'Relationship', 'Age', 'Gender']}
            scrollLabel="Family members on this account"
            rightCols={['Age']}
          >
            {family.map((f) => (
              <tr key={f.id}>
                <td className={`${tdClass} text-text-strong w-[34%] font-medium`}>
                  {fullName(f.firstName, f.lastName)}
                </td>
                <td className={tdClass}>{humanize(f.relation)}</td>
                <td className={`${tdClass} text-right tabular-nums`}>
                  {ageFrom(f.dateOfBirth, now)}
                </td>
                <td className={tdClass}>{f.gender ? humanize(f.gender) : NO_VALUE}</td>
              </tr>
            ))}
          </TableShell>
        ) : (
          <EmptyState
            compact
            icon="users"
            title="No family members added to this account."
            message="People this account books for would be listed here. Nothing to do from the console — the patient manages them in the app."
          />
        )}
      </Card>
      <Card>
        <div className="mb-4 flex items-center gap-2.5">
          <SectionTitle>Booking History</SectionTitle>
          <span className="text-caption text-text-muted">
            Latest bookings · read-only · no clinical data
          </span>
        </div>
        {u.bookings.length > 0 ? (
          <TableShell
            columns={['Hospital', 'Doctor', 'Date', 'Status']}
            scrollLabel="Booking history for this account"
          >
            {u.bookings.map((b) => {
              const bp = bookingStatusPill(b.status);
              return (
                <tr key={b.id}>
                  <td className={`${tdClass} text-text-strong w-[30%] font-medium`}>
                    {b.hospitalName}
                  </td>
                  <td className={tdClass}>{b.doctorName}</td>
                  <td className={tdClass}>{formatDate(b.scheduledStartAt)}</td>
                  <td className={tdClass}>
                    <Badge status={bp.badge}>{bp.label}</Badge>
                  </td>
                </tr>
              );
            })}
          </TableShell>
        ) : (
          <EmptyState
            compact
            icon="calendar-check"
            title="No bookings made from this account yet."
            message="The account is registered but has never booked — nothing here indicates a problem."
          />
        )}
      </Card>
      <OpsConfirm
        open={isConfirmOpen}
        onClose={closeConfirm}
        icon="ban"
        tone={blocked ? 'success' : 'neutral'}
        title={blocked ? 'Unblock this account?' : 'Block this account?'}
        body={
          blocked
            ? `${name} can make new bookings again immediately.`
            : `Existing upcoming bookings are unaffected. ${name} is signed out everywhere and cannot make new bookings until unblocked.`
        }
        confirmLabel={
          busy ? (blocked ? 'Unblocking…' : 'Blocking…') : blocked ? 'Unblock' : 'Block'
        }
        confirmVariant={blocked ? 'primary' : 'danger'}
        busy={busy}
        disabled={!blocked && !trimmedReason}
        onConfirm={handleConfirm}
      >
        {!blocked && (
          <div className="w-full text-left">
            <OpsField label="Reason" required hint="Recorded in the audit log.">
              {(field) => (
                <textarea
                  id={field.id}
                  aria-describedby={field.describedById}
                  value={reason}
                  maxLength={BLOCK_REASON_MAX}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Repeated no-shows reported by three hospitals"
                  className="border-border rounded-input text-body-lg text-text-strong h-18 w-full resize-none border p-3"
                ></textarea>
              )}
            </OpsField>
          </div>
        )}
      </OpsConfirm>
    </div>
  );
}
