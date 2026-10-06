import type { Result } from '@/core/error/failure';

import type {
  WalkInInput,
  WalkInResult,
} from '@/features/appointments/domain/entities/appointments.entities';
import { appointmentsRepository } from '@/features/appointments/infrastructure/repositories/appointments.repository.impl';

export function bookWalkIn(input: WalkInInput, replayKey: string): Promise<Result<WalkInResult>> {
  return appointmentsRepository.createWalkIn(input, replayKey);
}
