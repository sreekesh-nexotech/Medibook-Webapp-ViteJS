import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { HospitalBanner } from '@/features/settings/domain/entities/profile.entities';
import { profileKeys } from '@/features/settings/application/queries/profile.keys';
import { reorderBanners } from '@/features/settings/application/usecases/reorderBanners';

/** Save a new rotation order. Always re-reads, so a half-applied order shows as it is. */
export function useReorderBannersMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ordered: readonly HospitalBanner[]) => unwrap(await reorderBanners(ordered)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: profileKeys.banners() }),
  });
}
