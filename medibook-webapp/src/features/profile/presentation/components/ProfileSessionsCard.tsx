import { useState } from 'react';

import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Icon } from '@/shared/ui/Icon';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { Spinner } from '@/shared/ui/Spinner';
import { toast } from '@/shared/ui/toast/toast.store';

import { isFailure } from '@/core/error/failure';

import type { AuthSurface } from '@/features/auth/domain/entities/auth.types';
import { useActiveSessionsQuery } from '@/features/profile/application/queries/useActiveSessionsQuery';
import { useLogoutEverywhereMutation } from '@/features/profile/application/queries/useLogoutEverywhereMutation';
import { useRevokeSessionMutation } from '@/features/profile/application/queries/useRevokeSessionMutation';
import {
  deviceLabel,
  formatDateTime,
} from '@/features/profile/presentation/components/profileFormat';

interface ProfileSessionsCardProps {
  surface: AuthSurface;
  /** After "sign out everywhere" — this browser is signed out too. */
  onSignedOut: () => void;
}

/**
 * Where the user is signed in on this surface, with per-device sign-out and
 * "sign out everywhere". Loading, error (retry), empty and list states.
 */
export function ProfileSessionsCard({ surface, onSignedOut }: ProfileSessionsCardProps) {
  const sessions = useActiveSessionsQuery(surface);
  const revoke = useRevokeSessionMutation();
  const everywhere = useLogoutEverywhereMutation();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const handleRevoke = (sessionId: string) => {
    revoke.mutate(
      { surface, sessionId },
      {
        onSuccess: () => toast('That device was signed out'),
        onError: (failure) =>
          toast(isFailure(failure) ? failure.message : 'Could not sign that device out.', 'error'),
      },
    );
  };

  const handleEverywhere = () => {
    setIsConfirmOpen(false);
    everywhere.mutate(surface, {
      onSuccess: onSignedOut,
      onError: (failure) =>
        toast(isFailure(failure) ? failure.message : 'Could not sign out everywhere.', 'error'),
    });
  };

  let body;
  if (sessions.isPending) {
    body = (
      <div className="text-text-muted flex justify-center py-8">
        <Spinner size={24} label="Loading your devices" />
      </div>
    );
  } else if (sessions.isLoadingError) {
    body = (
      <ErrorState
        inline
        title="Could not load your devices"
        message={isFailure(sessions.error) ? sessions.error.message : undefined}
        onRetry={() => void sessions.refetch()}
      />
    );
  } else if (sessions.data.length === 0) {
    body = (
      <EmptyState
        compact
        icon="smartphone"
        title="No active sessions"
        message="Devices you sign in on will appear here."
      />
    );
  } else {
    body = (
      <ul className="divide-border-soft divide-y">
        {sessions.data.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="bg-bg-subtle text-text-muted flex size-9 items-center justify-center rounded-md">
              <Icon name="smartphone" size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-body text-text-strong flex items-center gap-2 font-medium">
                {deviceLabel(s.userAgent)}
                {s.current && <Badge status="Active">This device</Badge>}
              </div>
              <div className="text-caption text-text-muted">
                {s.ip} · last active {formatDateTime(s.lastSeenAt)} · signed in{' '}
                {formatDateTime(s.createdAt)}
              </div>
            </div>
            {!s.current && (
              <Button
                variant="secondary"
                size="sm"
                icon="log-out"
                onClick={() => handleRevoke(s.id)}
                busy={revoke.isPending && revoke.variables.sessionId === s.id}
              >
                Sign out
              </Button>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle>Signed-in Devices</SectionTitle>
        <Button
          variant="secondary"
          size="sm"
          icon="log-out"
          onClick={() => setIsConfirmOpen(true)}
          busy={everywhere.isPending}
        >
          Sign out everywhere
        </Button>
      </div>
      <div className="mt-3">{body}</div>
      <ConfirmModal
        open={isConfirmOpen}
        title="Sign out everywhere?"
        body="Every device signed in to your Medibook account — including this one — will be signed out."
        confirmLabel="Sign out everywhere"
        danger
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleEverywhere}
      />
    </Card>
  );
}
