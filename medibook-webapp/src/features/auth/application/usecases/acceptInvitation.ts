import type { Result } from '@/core/error/failure';

import type {
  InvitationAcceptance,
  StaffSession,
} from '@/features/auth/domain/entities/auth.types';
import { authRepository } from '@/features/auth/infrastructure/repositories/auth.repository.impl';

export function acceptInvitation(
  token: string,
  input: InvitationAcceptance,
): Promise<Result<StaffSession>> {
  return authRepository.acceptInvitation(token, input);
}
