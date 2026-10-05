import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { notificationsKeys } from '@/features/ops-notifications/application/queries/notifications.keys';
import { setBannerActive } from '@/features/ops-notifications/application/usecases/setBannerActive';
import type { CampaignBanner } from '@/features/ops-notifications/domain/entities/notifications.entities';

/** Pause a banner out of rotation, or resume it. */
export function useToggleBannerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (banner: CampaignBanner) =>
      unwrap(await setBannerActive(banner, !banner.active)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: notificationsKeys.banners() });
    },
  });
}
