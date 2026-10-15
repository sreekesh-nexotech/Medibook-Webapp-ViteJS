import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { contentKeys } from '@/features/ops-content/application/queries/content.keys';
import { fetchLocations } from '@/features/ops-content/application/usecases/fetchLocations';

/** Curated content changes only from this screen, which invalidates on every write. */
const CONTENT_STALE_MS = 60_000;

/** Every location the patient app can offer (`GET /platform/locations`). */
export function useContentLocationsQuery() {
  return useQuery({
    queryKey: contentKeys.locations(),
    queryFn: async () => unwrap(await fetchLocations()),
    staleTime: CONTENT_STALE_MS,
  });
}
