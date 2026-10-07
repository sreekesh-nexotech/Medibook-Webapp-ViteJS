import { MAX_PAGE_SIZE } from '@/core/api/pagination';
import { useOpsPermission } from '@/shared/hooks/useOpsPermission';

import { useHospitalsQuery } from '@/features/ops-hospitals/application/queries/useHospitalsQuery';
import type { HospitalListQuery } from '@/features/ops-hospitals/domain/entities/hospitals.entity';

/** One page of the registry, sorted by name — year one is 10 hospitals (CLAUDE.md). */
const OPTIONS_QUERY: HospitalListQuery = {
  page: 1,
  pageSize: MAX_PAGE_SIZE,
  q: '',
  statuses: [],
  planId: null,
  sort: 'name',
};

/** A hospital as a picker or a name lookup needs it. */
export interface HospitalOption {
  readonly id: string;
  readonly name: string;
}

/**
 * Hospital names for filters and lookups on other ops screens. The registry
 * read needs `hospitals.view`, so roles without it (compliance) get no
 * request and an empty list instead of a 403 — screens then fall back to the
 * names the row itself carries, or hide the hospital filter.
 */
export function useHospitalOptionsQuery() {
  const canView = useOpsPermission().can('hospitals.view');
  const query = useHospitalsQuery(OPTIONS_QUERY, canView);
  const options: readonly HospitalOption[] = canView
    ? (query.data?.items ?? []).map((h) => ({ id: h.id, name: h.name }))
    : [];
  return { canView, options, isPending: canView && query.isPending };
}
