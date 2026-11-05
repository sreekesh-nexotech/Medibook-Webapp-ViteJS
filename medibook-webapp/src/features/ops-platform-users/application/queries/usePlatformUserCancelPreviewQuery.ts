import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { platformUsersKeys } from '@/features/ops-platform-users/application/queries/platformUsers.keys';
import { previewCancelBookings } from '@/features/ops-platform-users/application/usecases/previewCancelBookings';

/** The dry run of "cancel and refund" for a blocked patient (UAT T10); writes nothing. */
export function usePlatformUserCancelPreviewQuery(id: string, enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: platformUsersKeys.cancelPreview(id),
    queryFn: async () => unwrap(await previewCancelBookings(id)),
  });
}
