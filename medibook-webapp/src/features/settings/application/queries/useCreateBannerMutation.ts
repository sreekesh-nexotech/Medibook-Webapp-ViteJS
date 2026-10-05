import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { BannerInput } from '@/features/settings/domain/entities/profile.entities';
import { profileKeys } from '@/features/settings/application/queries/profile.keys';
import { createBanner } from '@/features/settings/application/usecases/createBanner';

interface CreateBannerInput {
  readonly input: BannerInput;
  readonly sortOrder: number;
}

/** Publish a banner to the patient app. */
export function useCreateBannerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ input, sortOrder }: CreateBannerInput) =>
      unwrap(await createBanner(input, sortOrder)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: profileKeys.banners() }),
  });
}
