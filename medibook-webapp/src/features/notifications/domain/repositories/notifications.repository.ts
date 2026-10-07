import type { Result } from '@/core/error/failure';

import type { HospitalAlertFeed } from '@/features/notifications/domain/entities/notifications.types';

/** The hospital bell's server-side feed and read state (DASH-03). */
export interface NotificationsRepository {
  /** The feed, or `null` when the backend has no notification endpoint yet (older build). */
  getFeed(): Promise<Result<HospitalAlertFeed | null>>;
  /** Mark one item read; answers the updated feed. */
  markRead(key: string): Promise<Result<HospitalAlertFeed>>;
  /** Mark every item read; answers the updated feed. */
  markAllRead(): Promise<Result<HospitalAlertFeed>>;
}
