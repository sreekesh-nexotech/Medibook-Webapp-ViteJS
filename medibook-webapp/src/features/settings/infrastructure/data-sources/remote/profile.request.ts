import type {
  BannerChanges,
  HolidayInput,
} from '@/features/settings/domain/entities/profile.entities';

/**
 * Request DTOs for module H4 (`ScheduleHolidayRequest`,
 * `HospitalBannerRequest` / `PatchedHospitalBannerRequest`). Only keys present
 * in a partial banner update are sent, so omitted fields keep their value.
 */

export interface HolidayWriteRequest {
  readonly name: string;
  readonly date_from: string;
  readonly date_to: string;
  readonly department_id: string | null;
  readonly note: string | null;
}

export function toHolidayWriteRequest(input: HolidayInput): HolidayWriteRequest {
  return {
    name: input.name,
    date_from: input.from,
    date_to: input.to,
    department_id: input.departmentId,
    note: input.note,
  };
}

export interface BannerWriteRequest {
  readonly title?: string;
  readonly body?: string | null;
  readonly image_file_id?: string | null;
  readonly audience?: string;
  readonly starts_at?: string | null;
  readonly ends_at?: string | null;
  readonly sort_order?: number;
  readonly is_enabled?: boolean;
}

export function toBannerWriteRequest(c: BannerChanges): BannerWriteRequest {
  return {
    ...(c.title !== undefined && { title: c.title }),
    ...(c.body !== undefined && { body: c.body }),
    ...(c.imageFileId !== undefined && { image_file_id: c.imageFileId }),
    ...(c.audience !== undefined && { audience: c.audience }),
    ...(c.startsAt !== undefined && { starts_at: c.startsAt }),
    ...(c.endsAt !== undefined && { ends_at: c.endsAt }),
    ...(c.sortOrder !== undefined && { sort_order: c.sortOrder }),
    ...(c.isEnabled !== undefined && { is_enabled: c.isEnabled }),
  };
}
