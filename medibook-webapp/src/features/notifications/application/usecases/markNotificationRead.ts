import type { Result } from '@/core/error/failure';

import type { HospitalAlertFeed } from '@/features/notifications/domain/entities/notifications.types';
import { notificationsRepository } from '@/features/notifications/infrastructure/repositories/notifications.repository.impl';

export function markNotificationRead(key: string): Promise<Result<HospitalAlertFeed>> {
  return notificationsRepository.markRead(key);
}
