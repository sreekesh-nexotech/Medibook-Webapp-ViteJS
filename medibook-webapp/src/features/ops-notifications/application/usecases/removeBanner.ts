import type { Result } from '@/core/error/failure';

import type { CampaignBanner } from '@/features/ops-notifications/domain/entities/notifications.entities';
import { notificationsRepository } from '@/features/ops-notifications/infrastructure/repositories/notifications.repository.impl';

export function removeBanner(banner: CampaignBanner): Promise<Result<null>> {
  return notificationsRepository.deleteBanner(banner.id, banner.version);
}
