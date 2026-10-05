import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { BannerChanges } from '@/features/settings/domain/entities/profile.entities';
import { profileKeys } from '@/features/settings/application/queries/profile.keys';
import { updateBanner } from '@/features/settings/application/usecases/updateBanner';

interface UpdateBannerInput {
  readonly id: string;
  readonly changes: BannerChanges;
  readonly version: number;
}

/** Edit, pause or resume a banner (`If-Match` on the version that was edited). */
export function useUpdateBannerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, changes, version }: UpdateBannerInput) =>
      unwrap(await updateBanner(id, changes, version)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: profileKeys.banners() }),
  });
}
