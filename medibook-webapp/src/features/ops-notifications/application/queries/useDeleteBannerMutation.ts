import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { notificationsKeys } from '@/features/ops-notifications/application/queries/notifications.keys';
import { removeBanner } from '@/features/ops-notifications/application/usecases/removeBanner';
import type { CampaignBanner } from '@/features/ops-notifications/domain/entities/notifications.entities';

/** Remove a campaign banner from the app (soft delete). */
export function useDeleteBannerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (banner: CampaignBanner) => unwrap(await removeBanner(banner)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: notificationsKeys.banners() });
    },
  });
}
