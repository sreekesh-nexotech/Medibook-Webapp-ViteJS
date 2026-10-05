import type { Result } from '@/core/error/failure';

import type {
  HolidayInput,
  ScheduleChange,
} from '@/features/settings/domain/entities/profile.entities';
import { profileRepository } from '@/features/settings/infrastructure/repositories/profile.repository.impl';

/** Create (`id === null`) or update a closure — a dry run unless `confirm`. */
export function saveHoliday(
  id: string | null,
  input: HolidayInput,
  confirm: boolean,
): Promise<Result<ScheduleChange>> {
  return profileRepository.saveHoliday(id, input, confirm);
}
