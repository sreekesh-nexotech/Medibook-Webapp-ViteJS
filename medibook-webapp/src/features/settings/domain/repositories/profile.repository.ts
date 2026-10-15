import type { Result } from '@/core/error/failure';

import type {
  BannerChanges,
  BannerInput,
  Holiday,
  HolidayInput,
  HolidayRef,
  HolidayWriteMode,
  HospitalBanner,
  ScheduleChange,
} from '@/features/settings/domain/entities/profile.entities';

/** Hospital Profile (H4): the holiday calendar and the patient-app banners. */
export interface ProfileRepository {
  listHolidays(): Promise<Result<readonly Holiday[]>>;
  /**
   * Create (`existing === null`) or update a closure at the version the user
   * edited (`If-Match`). A dry run applies nothing — the result lists the
   * bookings confirming would cancel.
   */
  saveHoliday(
    existing: HolidayRef | null,
    input: HolidayInput,
    mode: HolidayWriteMode,
  ): Promise<Result<ScheduleChange>>;
  /** Remove a closure; dry run unless confirming. */
  removeHoliday(holiday: HolidayRef, mode: HolidayWriteMode): Promise<Result<ScheduleChange>>;

  listBanners(): Promise<Result<readonly HospitalBanner[]>>;
  createBanner(input: BannerInput, sortOrder: number): Promise<Result<HospitalBanner>>;
  updateBanner(
    id: string,
    changes: BannerChanges,
    version: number,
  ): Promise<Result<HospitalBanner>>;
  deleteBanner(id: string, version: number): Promise<Result<null>>;

  /** Upload a banner creative; resolves to the stored file id. */
  uploadBannerImage(file: File): Promise<Result<string>>;
  /** A short-lived signed URL to display a stored banner image. */
  getBannerImageUrl(fileId: string): Promise<Result<string>>;
}
