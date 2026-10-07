import { useMutation } from '@tanstack/react-query';

import { uploadFile } from '@/core/api/files.api';
import type { FileUploadInput } from '@/core/api/files.types';
import { unwrap } from '@/core/error/failure';

/**
 * Upload a file through the shared files API (create → PUT to storage →
 * complete). Resolves to the stored file in `scanning` status; its error is a
 * typed `Failure` (read it with `isFailure`).
 */
export function useFileUploadMutation() {
  return useMutation({
    mutationFn: async (input: FileUploadInput) => unwrap(await uploadFile(input)),
  });
}
