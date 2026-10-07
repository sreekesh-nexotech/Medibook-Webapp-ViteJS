import { useMutation } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { fetchTicketAttachmentUrl } from '@/features/ops-support/application/usecases/fetchTicketAttachmentUrl';

/** Fetch a fresh download link for an attachment, when it is clicked (links expire). */
export function useTicketAttachmentMutation() {
  return useMutation({
    mutationFn: async (fileId: string) => unwrap(await fetchTicketAttachmentUrl(fileId)),
  });
}
