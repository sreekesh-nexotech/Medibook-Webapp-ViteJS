import type { Result } from '@/core/error/failure';

import type { CampaignBanner } from '@/features/ops-notifications/domain/entities/notifications.entities';
import { notificationsRepository } from '@/features/ops-notifications/infrastructure/repositories/notifications.repository.impl';

/** Pause a banner out of rotation, or resume it, keeping its schedule. */
export function setBannerActive(
  banner: CampaignBanner,
  active: boolean,
): Promise<Result<CampaignBanner>> {
  return notificationsRepository.updateBanner(banner.id, banner.version, { active });
}
