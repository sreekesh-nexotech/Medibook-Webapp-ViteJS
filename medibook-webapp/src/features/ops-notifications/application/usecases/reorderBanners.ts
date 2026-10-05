import type { Result } from '@/core/error/failure';
import { err, ok } from '@/core/error/failure';

import type { CampaignBanner } from '@/features/ops-notifications/domain/entities/notifications.entities';
import { notificationsRepository } from '@/features/ops-notifications/infrastructure/repositories/notifications.repository.impl';

/**
 * Persist a rotation order: each banner's `sort_order` becomes its index.
 * Only banners whose position changed are written, one at a time; the first
 * failure stops the run (the caller re-reads the list).
 */
export async function reorderBanners(ordered: readonly CampaignBanner[]): Promise<Result<null>> {
  for (const [index, banner] of ordered.entries()) {
    if (banner.sortOrder === index) continue;
    const result = await notificationsRepository.updateBanner(banner.id, banner.version, {
      sortOrder: index,
    });
    if (!result.ok) return err(result.failure);
  }
  return ok(null);
}
