import type { ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Icon } from '@/shared/ui/Icon';
import { Spinner } from '@/shared/ui/Spinner';

import { isFailure } from '@/core/error/failure';

import { AUTH_LOGIN_PATH, AUTH_TOKEN_PARAM, hospitalDashboardPath } from '@/app/router/paths';

import type { StaffSession } from '@/features/auth/domain/entities/auth.types';
import { useInvitationQuery } from '@/features/auth/application/queries/useInvitationQuery';
import { hospitalUrlRole } from '@/features/auth/application/store/auth.roles';
import { BrandPanel } from '@/features/auth/presentation/components/BrandPanel';
import { InvitationForm } from '@/features/auth/presentation/components/InvitationForm';

/** The backend's answer for an expired, used or revoked invitation (410). */
const INVITATION_EXPIRED_CODE = 'INVITATION_EXPIRED';

interface DeadEndProps {
  title: string;
  message: string;
  onBack: () => void;
}

/** A link that cannot be used: say why, offer the way to login. */
function DeadEnd({ title, message, onBack }: DeadEndProps) {
  return (
    <div className="text-center">
      <div className="bg-d-100 text-d-500 mx-auto mb-5.5 flex size-18 items-center justify-center rounded-full">
        <Icon name="triangle-alert" size={34} />
      </div>
      <div className="text-h2 text-text-strong mb-2.5">{title}</div>
      <p className="text-body text-text-muted mx-auto mb-7 max-w-80">{message}</p>
      <Button variant="info" className="h-13.5 w-full rounded-sm" onClick={onBack}>
        Back to Login
      </Button>
    </div>
  );
}

/**
 * Join a hospital from an emailed invitation (`/accept-invite?token=…`):
 * preview the invitation, set name + password, and land signed in on the new
 * role's dashboard. Handles a missing token, an expired/used invitation, a
 * failed preview (retry) and the loading state.
 */
export function AcceptInvitationScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get(AUTH_TOKEN_PARAM) ?? '';
  const invitation = useInvitationQuery(token);
  const back = () => navigate(AUTH_LOGIN_PATH, { replace: true });

  const handleAccepted = (session: StaffSession) => {
    const role = session.surface === 'hospital' ? hospitalUrlRole(session.role.code) : 'admin';
    navigate(hospitalDashboardPath(role), { replace: true });
  };

  let body: ReactNode;
  if (!token) {
    body = (
      <DeadEnd
        title="This link is incomplete"
        message="Open the invitation link from your email again."
        onBack={back}
      />
    );
  } else if (invitation.isPending) {
    body = (
      <div className="text-text-muted flex justify-center py-10">
        <Spinner size={32} label="Loading your invitation" />
      </div>
    );
  } else if (invitation.isError) {
    body =
      isFailure(invitation.error) && invitation.error.code === INVITATION_EXPIRED_CODE ? (
        <DeadEnd
          title="This invitation has expired"
          message="It may have been used already or withdrawn. Ask your hospital administrator to send a new one."
          onBack={back}
        />
      ) : (
        <ErrorState
          inline
          title="We could not load your invitation"
          message={isFailure(invitation.error) ? invitation.error.message : undefined}
          onRetry={() => void invitation.refetch()}
        />
      );
  } else {
    body = (
      <>
        <div className="text-display text-text-strong mb-2">
          Join {invitation.data.hospitalName}
        </div>
        <p className="text-body text-text-muted mb-7.5">
          You've been invited as <b className="text-text-body">{invitation.data.roleName}</b>. Set
          your name and a password to start using mbAdmin.
        </p>
        <InvitationForm token={token} invitation={invitation.data} onAccepted={handleAccepted} />
      </>
    );
  }

  return (
    <div className="flex h-full bg-white">
      <BrandPanel />
      <div className="flex flex-1 items-center justify-center overflow-y-auto p-10">
        <div className="w-full max-w-100">{body}</div>
      </div>
    </div>
  );
}
