import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { notificationsKeys } from '@/features/notifications/application/queries/notifications.keys';
import { markAllNotificationsRead } from '@/features/notifications/application/usecases/markAllNotificationsRead';
import { markNotificationRead } from '@/features/notifications/application/usecases/markNotificationRead';

/**
 * Mark one bell item (`key`) or all of them (`null`) read on the server. The
 * answer is the updated feed, which replaces the cached one.
 */
export function useMarkNotificationsReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (key: string | null) =>
      unwrap(await (key === null ? markAllNotificationsRead() : markNotificationRead(key))),
    onSuccess: (feed) => {
      queryClient.setQueryData(notificationsKeys.feed(), feed);
    },
  });
}
