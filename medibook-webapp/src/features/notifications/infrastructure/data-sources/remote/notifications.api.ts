import { hospitalApi } from '@/core/api/http';

import type { HospitalAlertFeedResponse } from '@/features/notifications/infrastructure/data-sources/remote/notifications.response';
import { hospitalAlertFeedResponseSchema } from '@/features/notifications/infrastructure/data-sources/remote/notifications.response';

/** `GET /hospital/notifications` (`dashboard.view`). */
export async function getNotifications(): Promise<HospitalAlertFeedResponse> {
  const response = await hospitalApi.get('/notifications');
  return hospitalAlertFeedResponseSchema.parse(response.data);
}

/** `POST /hospital/notifications/{key}/read` → the updated feed. */
export async function postNotificationRead(key: string): Promise<HospitalAlertFeedResponse> {
  const response = await hospitalApi.post(`/notifications/${encodeURIComponent(key)}/read`);
  return hospitalAlertFeedResponseSchema.parse(response.data);
}

/** `POST /hospital/notifications/read-all` → the updated feed. */
export async function postNotificationsReadAll(): Promise<HospitalAlertFeedResponse> {
  const response = await hospitalApi.post('/notifications/read-all');
  return hospitalAlertFeedResponseSchema.parse(response.data);
}
