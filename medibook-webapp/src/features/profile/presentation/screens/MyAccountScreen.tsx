import { useNavigate } from 'react-router-dom';

import { ErrorState } from '@/shared/ui/ErrorState';
import { Spinner } from '@/shared/ui/Spinner';

import { isFailure } from '@/core/error/failure';

import { AUTH_LOGIN_PATH } from '@/app/router/paths';

import type { AuthSurface } from '@/features/auth/domain/entities/auth.types';
import { useSessionQuery } from '@/features/auth/application/queries/useSessionQuery';
import { ProfileBuildInfo } from '@/features/profile/presentation/components/ProfileBuildInfo';
import { ProfileNameCard } from '@/features/profile/presentation/components/ProfileNameCard';
import { ProfilePasswordCard } from '@/features/profile/presentation/components/ProfilePasswordCard';
import { ProfileSessionsCard } from '@/features/profile/presentation/components/ProfileSessionsCard';

interface MyAccountScreenProps {
  surface: AuthSurface;
}

/**
 * My account (hospital `/:role/account`, ops `/ops/account`): the signed-in
 * user's name, password and signed-in devices, and which build is running. MFA is not offered — the
 * backend's MFA endpoints are honest 501 stubs (2FA is "not now", Q64).
 */
export function MyAccountScreen({ surface }: MyAccountScreenProps) {
  const navigate = useNavigate();
  const session = useSessionQuery(surface);

  if (session.isPending) {
    return (
      <div className="text-text-muted flex justify-center py-16">
        <Spinner size={32} label="Loading your account" />
      </div>
    );
  }
  if (session.isError) {
    return (
      <ErrorState
        title="Could not load your account"
        message={isFailure(session.error) ? session.error.message : undefined}
        onRetry={() => void session.refetch()}
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-240 flex-col gap-4">
      <ProfileNameCard key={session.data.user.version} session={session.data} />
      <ProfilePasswordCard surface={surface} />
      <ProfileSessionsCard
        surface={surface}
        onSignedOut={() => navigate(AUTH_LOGIN_PATH, { replace: true })}
      />
      <ProfileBuildInfo />
    </div>
  );
}
