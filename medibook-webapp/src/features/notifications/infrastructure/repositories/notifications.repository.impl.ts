import { attempt } from '@/core/error/attempt';
import { ok } from '@/core/error/failure';

import type { NotificationsRepository } from '@/features/notifications/domain/repositories/notifications.repository';
import {
  getNotifications,
  postNotificationRead,
  postNotificationsReadAll,
} from '@/features/notifications/infrastructure/data-sources/remote/notifications.api';
import { toHospitalAlertFeed } from '@/features/notifications/infrastructure/data-sources/remote/notifications.response';

export const notificationsRepository: NotificationsRepository = {
  getFeed: async () => {
    const result = await attempt(async () => toHospitalAlertFeed(await getNotifications()));
    // A backend without DASH-03 answers 404: the bell then builds itself
    // from the dashboard and keeps read state in the browser.
    if (!result.ok && result.failure.kind === 'notFound') return ok(null);
    return result;
  },
  markRead: (key) => attempt(async () => toHospitalAlertFeed(await postNotificationRead(key))),
  markAllRead: () => attempt(async () => toHospitalAlertFeed(await postNotificationsReadAll())),
};
