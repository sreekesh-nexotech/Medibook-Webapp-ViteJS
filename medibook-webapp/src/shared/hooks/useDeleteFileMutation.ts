import { useMutation, useQueryClient } from '@tanstack/react-query';

import { deleteFile } from '@/core/api/files.api';
import { filesKeys } from '@/core/api/files.keys';
import { unwrap } from '@/core/error/failure';

interface DeleteFileInput {
  readonly fileId: string;
  /** The version you read, sent as `If-Match`. */
  readonly version?: number;
}

/** Soft-delete a stored file. Fails with `FILE_IN_USE` while something references it. */
export function useDeleteFileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ fileId, version }: DeleteFileInput) =>
      unwrap(await deleteFile(fileId, version)),
    onSuccess: (_data, { fileId }) => {
      queryClient.removeQueries({ queryKey: filesKeys.detail(fileId) });
    },
  });
}
