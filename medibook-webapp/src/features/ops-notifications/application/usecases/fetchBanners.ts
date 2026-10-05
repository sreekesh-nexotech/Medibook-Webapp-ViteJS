import type { Result } from '@/core/error/failure';

import type { CampaignBanner } from '@/features/ops-notifications/domain/entities/notifications.entities';
import { notificationsRepository } from '@/features/ops-notifications/infrastructure/repositories/notifications.repository.impl';

export function fetchBanners(): Promise<Result<readonly CampaignBanner[]>> {
  return notificationsRepository.listBanners();
}
