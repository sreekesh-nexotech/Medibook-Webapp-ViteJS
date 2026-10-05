import type { Result } from '@/core/error/failure';

import { notificationsRepository } from '@/features/ops-notifications/infrastructure/repositories/notifications.repository.impl';

export function fetchBannerImageUrl(fileId: string): Promise<Result<string>> {
  return notificationsRepository.getBannerImageUrl(fileId);
}
