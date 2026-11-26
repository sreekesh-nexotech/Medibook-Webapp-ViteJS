import { z } from 'zod';

import type { ResolvedMapLocation } from '@/core/api/mapLocation.types';

/** `POST …/location/resolve` → `{lat, lng, source, in_india}` (backend `map_location.resolve`). */
export const resolvedMapLocationResponseSchema = z.object({
  lat: z.string(),
  lng: z.string(),
  source: z.enum(['coordinates', 'link', 'short_link']),
  in_india: z.boolean(),
});

export function toResolvedMapLocation(
  dto: z.infer<typeof resolvedMapLocationResponseSchema>,
): ResolvedMapLocation {
  return { lat: dto.lat, lng: dto.lng, source: dto.source, inIndia: dto.in_india };
}
