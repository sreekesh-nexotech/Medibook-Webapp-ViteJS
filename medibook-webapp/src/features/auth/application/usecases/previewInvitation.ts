import type { Result } from '@/core/error/failure';

import type { InvitationPreview } from '@/features/auth/domain/entities/auth.types';
import { authRepository } from '@/features/auth/infrastructure/repositories/auth.repository.impl';

export function previewInvitation(token: string): Promise<Result<InvitationPreview>> {
  return authRepository.previewInvitation(token);
}
