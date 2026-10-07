import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { messageTemplatesKeys } from '@/features/ops-message-templates/application/queries/messageTemplates.keys';
import { fetchMessageTemplates } from '@/features/ops-message-templates/application/usecases/fetchMessageTemplates';

/** Templates change only from this screen, which invalidates on every write. */
const TEMPLATES_STALE_MS = 60_000;

/** Every platform message template (`GET /platform/messaging/templates`). */
export function useMessageTemplatesQuery() {
  return useQuery({
    queryKey: messageTemplatesKeys.list(),
    queryFn: async () => unwrap(await fetchMessageTemplates()),
    staleTime: TEMPLATES_STALE_MS,
  });
}
