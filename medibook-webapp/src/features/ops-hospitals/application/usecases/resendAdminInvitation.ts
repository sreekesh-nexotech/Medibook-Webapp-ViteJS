import type { Result } from '@/core/error/failure';

import type {
  FirstAdminInvitation,
  FirstAdminResend,
} from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import { hospitalsRepository } from '@/features/ops-hospitals/infrastructure/repositories/hospitals.repository.impl';

export function resendAdminInvitation(
  hospitalId: string,
  resend: FirstAdminResend,
): Promise<Result<FirstAdminInvitation>> {
  return hospitalsRepository.resendAdminInvitation(hospitalId, resend);
}
