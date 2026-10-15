import type { Result } from '@/core/error/failure';

import type {
  HolidayRef,
  HolidayWriteMode,
  ScheduleChange,
} from '@/features/settings/domain/entities/profile.entities';
import { profileRepository } from '@/features/settings/infrastructure/repositories/profile.repository.impl';

/** Remove a closure — a dry run unless confirming. */
export function removeHoliday(
  holiday: HolidayRef,
  mode: HolidayWriteMode,
): Promise<Result<ScheduleChange>> {
  return profileRepository.removeHoliday(holiday, mode);
}
