import type { Result } from '@/core/error/failure';

import type { ScheduleChange } from '@/features/settings/domain/entities/profile.entities';
import { profileRepository } from '@/features/settings/infrastructure/repositories/profile.repository.impl';

/** Remove a closure — a dry run unless `confirm`. */
export function removeHoliday(id: string, confirm: boolean): Promise<Result<ScheduleChange>> {
  return profileRepository.removeHoliday(id, confirm);
}
