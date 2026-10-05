import type { Result } from '@/core/error/failure';

import type {
  BannerFields,
  BannerPatch,
  CampaignBanner,
} from '@/features/ops-notifications/domain/entities/notifications.entities';

/** Platform-wide patient-app banners (`/platform/banners`, `settings.*`). */
export interface NotificationsRepository {
  /** Every banner, in rotation order. */
  listBanners(): Promise<Result<readonly CampaignBanner[]>>;
  createBanner(fields: BannerFields, sortOrder: number): Promise<Result<CampaignBanner>>;
  /** Partial edit; `version` guards against a concurrent change. */
  updateBanner(id: string, version: number, patch: BannerPatch): Promise<Result<CampaignBanner>>;
  /** Soft delete. */
  deleteBanner(id: string, version: number): Promise<Result<null>>;
  /** Upload a creative and wait for its virus scan; resolves to the file id. */
  uploadBannerImage(file: File): Promise<Result<string>>;
  /** A short-lived signed link to show a stored creative. */
  getBannerImageUrl(fileId: string): Promise<Result<string>>;
}
