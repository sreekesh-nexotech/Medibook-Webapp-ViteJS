import type { Result } from '@/core/error/failure';

import type {
  HolidayInput,
  HolidayTarget,
  ScheduleChange,
} from '@/features/settings/domain/entities/profile.entities';
import { profileRepository } from '@/features/settings/infrastructure/repositories/profile.repository.impl';

/** Create (`target === null`) or update a closure — a dry run unless `confirm`. */
export function saveHoliday(
  target: HolidayTarget | null,
  input: HolidayInput,
  confirm: boolean,
  replayKey: string,
): Promise<Result<ScheduleChange>> {
  return profileRepository.saveHoliday(target, input, confirm, replayKey);
}
