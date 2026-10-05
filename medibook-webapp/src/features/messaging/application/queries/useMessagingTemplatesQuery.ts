import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { MESSAGING_TEMPLATES_STALE_TIME_MS } from '@/features/messaging/application/queries/messaging.config';
import { messagingKeys } from '@/features/messaging/application/queries/messaging.keys';
import { fetchMessagingTemplates } from '@/features/messaging/application/usecases/fetchMessagingTemplates';
import type { PatientChannel } from '@/features/messaging/domain/entities/messaging.entities';

/** The platform's templates on one patient channel (read-only, Q112). */
export function useMessagingTemplatesQuery(channel: PatientChannel) {
  return useQuery({
    queryKey: messagingKeys.templates(channel),
    queryFn: async () => unwrap(await fetchMessagingTemplates(channel)),
    staleTime: MESSAGING_TEMPLATES_STALE_TIME_MS,
  });
}
