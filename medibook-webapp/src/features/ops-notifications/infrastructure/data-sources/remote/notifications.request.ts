import type {
  BannerFields,
  BannerPatch,
} from '@/features/ops-notifications/domain/entities/notifications.entities';

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

const LAST_HOUR = 23;
const LAST_MINUTE = 59;
const LAST_SECOND = 59;
const LAST_MS = 999;

/** Parse a local `yyyy-mm-dd` into its numeric parts. */
function dayParts(day: string): [number, number, number] {
  const [y, m, d] = day.split('-').map(Number);
  return [y, m - 1, d];
}

/** Local midnight that starts `day`, as a UTC timestamp. */
function startOfDay(day: string | null): string | null {
  if (!day) return null;
  const [y, m, d] = dayParts(day);
  return new Date(y, m, d).toISOString();
}

/**
 * The last instant of local `day`, as a UTC timestamp — so a one-day
 * campaign (`from === to`) still satisfies the backend's `ends_at > starts_at`.
 */
function endOfDay(day: string | null): string | null {
  if (!day) return null;
  const [y, m, d] = dayParts(day);
  return new Date(y, m, d, LAST_HOUR, LAST_MINUTE, LAST_SECOND, LAST_MS).toISOString();
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
