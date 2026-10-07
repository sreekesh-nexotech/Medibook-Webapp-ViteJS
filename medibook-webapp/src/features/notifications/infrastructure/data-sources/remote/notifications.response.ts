import { z } from 'zod';

import type { HospitalAlertFeed } from '@/features/notifications/domain/entities/notifications.types';

/** `HospitalAlertFeedSerializer` (`analytics/serializers/hospital_alert_feed_serializer.py`). */
export const hospitalAlertFeedResponseSchema = z.object({
  items: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      count: z.number().int(),
      latest_at: z.string().nullable(),
      amount_paise: z.number().int().optional(),
      read: z.boolean(),
      read_at: z.string().nullable(),
    }),
  ),
  unread_count: z.number().int(),
});

export type HospitalAlertFeedResponse = z.infer<typeof hospitalAlertFeedResponseSchema>;

export function toHospitalAlertFeed(dto: HospitalAlertFeedResponse): HospitalAlertFeed {
  return {
    items: dto.items.map((item) => ({
      key: item.key,
      label: item.label,
      count: item.count,
      latestAt: item.latest_at,
      amountPaise: item.amount_paise ?? null,
      read: item.read,
      readAt: item.read_at,
    })),
    unreadCount: dto.unread_count,
  };
}
