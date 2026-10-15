import type { Result } from '@/core/error/failure';

import type {
  WalkInInput,
  WalkInResult,
} from '@/features/appointments/domain/entities/appointments.entities';
import { appointmentsRepository } from '@/features/appointments/infrastructure/repositories/appointments.repository.impl';

export function bookWalkIn(
  input: WalkInInput,
  idempotencyKey: string,
): Promise<Result<WalkInResult>> {
  return appointmentsRepository.createWalkIn(input, idempotencyKey);
}
