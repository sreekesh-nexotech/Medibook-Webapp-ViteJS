import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { notificationsKeys } from '@/features/ops-notifications/application/queries/notifications.keys';
import { reorderBanners } from '@/features/ops-notifications/application/usecases/reorderBanners';
import type { CampaignBanner } from '@/features/ops-notifications/domain/entities/notifications.entities';

/** Save a new rotation order (the full list, top first). */
export function useReorderBannersMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ordered: readonly CampaignBanner[]) => unwrap(await reorderBanners(ordered)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: notificationsKeys.banners() });
    },
  });
}
