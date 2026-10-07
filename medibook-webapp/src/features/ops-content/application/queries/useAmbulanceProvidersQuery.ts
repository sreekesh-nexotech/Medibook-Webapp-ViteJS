import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { contentKeys } from '@/features/ops-content/application/queries/content.keys';
import { fetchAmbulanceProviders } from '@/features/ops-content/application/usecases/fetchAmbulanceProviders';

/** Curated content changes only from this screen, which invalidates on every write. */
const CONTENT_STALE_MS = 60_000;

/** Every ambulance provider (`GET /platform/ambulance-providers`). */
export function useAmbulanceProvidersQuery() {
  return useQuery({
    queryKey: contentKeys.ambulance(),
    queryFn: async () => unwrap(await fetchAmbulanceProviders()),
    staleTime: CONTENT_STALE_MS,
  });
}
