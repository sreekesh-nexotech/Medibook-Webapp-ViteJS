import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { notificationsKeys } from '@/features/ops-notifications/application/queries/notifications.keys';
import { saveBanner } from '@/features/ops-notifications/application/usecases/saveBanner';
import type {
  BannerDraft,
  CampaignBanner,
} from '@/features/ops-notifications/domain/entities/notifications.entities';

interface SaveBannerInput {
  /** The banner being edited, or null to add one. */
  readonly target: CampaignBanner | null;
  readonly draft: BannerDraft;
  /** Rotation slot for a new banner (after the last one). */
  readonly nextSortOrder: number;
}

/** Add or edit a campaign banner (uploading a new creative first). */
export function useSaveBannerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ target, draft, nextSortOrder }: SaveBannerInput) =>
      unwrap(await saveBanner(target, draft, nextSortOrder)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: notificationsKeys.banners() });
    },
  });
}
