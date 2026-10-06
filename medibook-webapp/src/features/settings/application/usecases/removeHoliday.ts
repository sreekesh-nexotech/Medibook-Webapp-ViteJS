import type { Result } from '@/core/error/failure';

import type {
  HolidayTarget,
  ScheduleChange,
} from '@/features/settings/domain/entities/profile.entities';
import { profileRepository } from '@/features/settings/infrastructure/repositories/profile.repository.impl';

/** Remove a closure — a dry run unless `confirm`. */
export function removeHoliday(
  target: HolidayTarget,
  confirm: boolean,
  replayKey: string,
): Promise<Result<ScheduleChange>> {
  return profileRepository.removeHoliday(target, confirm, replayKey);
}
