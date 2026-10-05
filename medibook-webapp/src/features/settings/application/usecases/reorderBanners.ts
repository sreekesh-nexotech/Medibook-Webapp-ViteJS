import type { Result } from '@/core/error/failure';
import { ok } from '@/core/error/failure';

import type { HospitalBanner } from '@/features/settings/domain/entities/profile.entities';
import { profileRepository } from '@/features/settings/infrastructure/repositories/profile.repository.impl';

/**
 * Persist a new rotation order: banner `i` gets `sort_order = i`. Only the
 * banners whose position changed are written, one PATCH each (the API has no
 * bulk reorder), stopping at the first failure.
 */
export async function reorderBanners(ordered: readonly HospitalBanner[]): Promise<Result<null>> {
  for (const [index, banner] of ordered.entries()) {
    if (banner.sortOrder === index) continue;
    const result = await profileRepository.updateBanner(
      banner.id,
      { sortOrder: index },
      banner.version,
    );
    if (!result.ok) return result;
  }
  return ok(null);
}
