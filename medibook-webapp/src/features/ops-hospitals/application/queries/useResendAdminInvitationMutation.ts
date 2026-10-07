import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { FirstAdminResend } from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import { invalidateOnboarding } from '@/features/ops-hospitals/application/queries/onboarding.keys';
import { resendAdminInvitation } from '@/features/ops-hospitals/application/usecases/resendAdminInvitation';

interface ResendAdminInvitationInput {
  readonly hospitalId: string;
  readonly resend: FirstAdminResend;
}

/**
 * Re-send the first administrator's invitation (CORE-04). The hospital
 * detail and the onboarding case both show its status, so both are re-read.
 */
export function useResendAdminInvitationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ hospitalId, resend }: ResendAdminInvitationInput) =>
      unwrap(await resendAdminInvitation(hospitalId, resend)),
    onSettled: () => invalidateOnboarding(queryClient),
  });
}
