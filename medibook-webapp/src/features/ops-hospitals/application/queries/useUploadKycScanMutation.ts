import { useMutation } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { uploadKycScan } from '@/features/ops-hospitals/application/usecases/uploadKycScan';

/** Upload a document scan. Nothing is attached until the checklist item is updated. */
export function useUploadKycScanMutation() {
  return useMutation({
    mutationFn: async (file: File) => unwrap(await uploadKycScan(file)),
  });
}
