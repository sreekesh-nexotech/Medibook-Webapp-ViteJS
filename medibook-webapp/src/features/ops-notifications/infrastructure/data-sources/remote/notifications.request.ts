import type {
  BannerFields,
  BannerPatch,
} from '@/features/ops-notifications/domain/entities/notifications.entities';
import { calendarInstant } from '@/shared/lib/format';

/**
 * `ConfigBannerRequest` / `PatchedConfigBannerRequest` (`schema.yml`). The
 * backend rejects unknown fields, so only the ones set are sent. `body`, the
 * CTA and `audience` are not edited here and keep their server defaults.
 */
export interface BannerWriteRequest {
  title?: string;
  image_file?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  sort_order?: number;
  is_enabled?: boolean;
}

/** The last instant of a day, so a one-day campaign still has `ends_at > starts_at`. */
const LAST_INSTANT = '23:59:59.999';

/** Midnight that starts `day` in India Standard Time (DATA-03). */
function startOfDay(day: string | null): string | null {
  return day ? calendarInstant(day) : null;
}

/** The last instant of `day` in India Standard Time. */
function endOfDay(day: string | null): string | null {
  return day ? calendarInstant(day, LAST_INSTANT) : null;
}

export function toCreateRequest(fields: BannerFields, sortOrder: number): BannerWriteRequest {
  return {
    title: fields.title,
    image_file: fields.imageFileId,
    starts_at: startOfDay(fields.from),
    ends_at: endOfDay(fields.to),
    sort_order: sortOrder,
    is_enabled: true,
  };
}

export function toPatchRequest(patch: BannerPatch): BannerWriteRequest {
  const body: BannerWriteRequest = {};
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.imageFileId !== undefined) body.image_file = patch.imageFileId;
  if (patch.from !== undefined) body.starts_at = startOfDay(patch.from);
  if (patch.to !== undefined) body.ends_at = endOfDay(patch.to);
  if (patch.active !== undefined) body.is_enabled = patch.active;
  if (patch.sortOrder !== undefined) body.sort_order = patch.sortOrder;
  return body;
}
