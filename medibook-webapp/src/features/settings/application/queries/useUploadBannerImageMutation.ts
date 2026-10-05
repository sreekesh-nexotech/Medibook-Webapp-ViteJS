import { useMutation } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { uploadBannerImage } from '@/features/settings/application/usecases/uploadBannerImage';

/** Upload a banner creative. Nothing is attached until the banner is saved. */
export function useUploadBannerImageMutation() {
  return useMutation({
    mutationFn: async (file: File) => unwrap(await uploadBannerImage(file)),
  });
}
