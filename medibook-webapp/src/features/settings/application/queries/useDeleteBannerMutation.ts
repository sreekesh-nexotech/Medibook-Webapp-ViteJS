import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { profileKeys } from '@/features/settings/application/queries/profile.keys';
import { deleteBanner } from '@/features/settings/application/usecases/deleteBanner';

interface DeleteBannerInput {
  readonly id: string;
  readonly version: number;
}

/** Delete a banner — it leaves the patient app immediately. */
export function useDeleteBannerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, version }: DeleteBannerInput) =>
      unwrap(await deleteBanner(id, version)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: profileKeys.banners() }),
  });
}
