import type { Result } from '@/core/error/failure';

import type {
  HolidayInput,
  HolidayRef,
  HolidayWriteMode,
  ScheduleChange,
} from '@/features/settings/domain/entities/profile.entities';
import { profileRepository } from '@/features/settings/infrastructure/repositories/profile.repository.impl';

/** Create (`existing === null`) or update a closure — a dry run unless confirming. */
export function saveHoliday(
  existing: HolidayRef | null,
  input: HolidayInput,
  mode: HolidayWriteMode,
): Promise<Result<ScheduleChange>> {
  return profileRepository.saveHoliday(existing, input, mode);
}
