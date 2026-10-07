import type { Result } from '@/core/error/failure';
import { err, ok } from '@/core/error/failure';

import type {
  BannerDraft,
  CampaignBanner,
} from '@/features/ops-notifications/domain/entities/notifications.entities';
import { notificationsRepository } from '@/features/ops-notifications/infrastructure/repositories/notifications.repository.impl';

/** Where the banner's creative ends up: an uploaded file, the current one, or none. */
async function resolveImage(
  target: CampaignBanner | null,
  draft: BannerDraft,
): Promise<Result<string | null>> {
  switch (draft.image.kind) {
    case 'upload':
      return notificationsRepository.uploadBannerImage(draft.image.file);
    case 'remove':
      return ok(null);
    case 'keep':
      return ok(target?.imageFileId ?? null);
  }
}

/**
 * Add a campaign banner (`target` null, placed last in the rotation at
 * `nextSortOrder`) or edit one. Uploads a new creative first.
 */
export async function saveBanner(
  target: CampaignBanner | null,
  draft: BannerDraft,
  nextSortOrder: number,
): Promise<Result<CampaignBanner>> {
  const image = await resolveImage(target, draft);
  if (!image.ok) return err(image.failure);
  const fields = {
    title: draft.title.trim(),
    body: draft.body,
    ctaLabel: draft.ctaLabel,
    ctaTarget: draft.ctaTarget,
    audience: draft.audience,
    imageFileId: image.data,
    from: draft.from,
    to: draft.to,
  };
  return target
    ? notificationsRepository.updateBanner(target.id, target.version, fields)
    : notificationsRepository.createBanner(fields, nextSortOrder);
}
