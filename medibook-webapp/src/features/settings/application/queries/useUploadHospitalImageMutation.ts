import { useMutation } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { HospitalImagePurpose } from '@/features/settings/domain/entities/settings.entities';
import { uploadHospitalImage } from '@/features/settings/application/usecases/uploadHospitalImage';

interface UploadImageInput {
  readonly file: File;
  readonly purpose: HospitalImagePurpose;
}

/**
 * Upload a logo or cover image. Resolves to the file id; nothing is attached
 * until the profile is saved, so no cached query changes here.
 */
export function useUploadHospitalImageMutation() {
  return useMutation({
    mutationFn: async ({ file, purpose }: UploadImageInput) =>
      unwrap(await uploadHospitalImage(file, purpose)),
  });
}
