import { useMutation, useQueryClient } from '@tanstack/react-query';

import { uploadFile } from '@/core/api/files.api';
import { filesKeys } from '@/core/api/files.keys';
import type { FileUploadInput } from '@/core/api/files.types';
import { unwrap } from '@/core/error/failure';

/**
 * Upload a file through the shared files API (create → PUT to storage →
 * complete). Resolves to the stored file in `scanning` status; its error is a
 * typed `Failure` (read it with `isFailure`).
 */
export function useFileUploadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: FileUploadInput) => unwrap(await uploadFile(input)),
    onSuccess: (file) => {
      queryClient.setQueryData(filesKeys.detail(file.id), file);
    },
  });
}
