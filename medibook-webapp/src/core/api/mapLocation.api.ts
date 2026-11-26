import { apiFor } from '@/core/api/http';
import {
  resolvedMapLocationResponseSchema,
  toResolvedMapLocation,
} from '@/core/api/mapLocation.response';
import type { ResolvedMapLocation } from '@/core/api/mapLocation.types';
import { activeSurface } from '@/core/api/surface';
import { attempt } from '@/core/error/attempt';
import type { Result } from '@/core/error/failure';

/**
 * Where each surface reads a pasted location: the hospital admin's own profile
 * (`/hospital/profile/location/resolve`), and Ops' Onboard Hospital / Edit Profile forms
 * (`/platform/hospitals/location/resolve`). Same body and answer on both.
 */
const RESOLVE_PATH = {
  hospital: '/profile/location/resolve',
  platform: '/hospitals/location/resolve',
} as const;

/** Read a Google Maps link or typed coordinates into `{lat, lng}` on the active surface. */
export function resolveMapLocation(text: string): Promise<Result<ResolvedMapLocation>> {
  const surface = activeSurface();
  return attempt(async () => {
    const response = await apiFor(surface).post(RESOLVE_PATH[surface], { text });
    return toResolvedMapLocation(resolvedMapLocationResponseSchema.parse(response.data));
  });
}
