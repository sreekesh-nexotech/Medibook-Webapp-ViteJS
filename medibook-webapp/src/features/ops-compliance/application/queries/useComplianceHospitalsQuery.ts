import { MAX_PAGE_SIZE } from '@/core/api/pagination';

import { useHospitalsQuery } from '@/features/ops-hospitals/application/queries/useHospitalsQuery';
import type { HospitalListQuery } from '@/features/ops-hospitals/domain/entities/hospitals.entity';

/**
 * The hospital registry (P2) as compliance needs it: names for the
 * Instance column and options for the instance filter. One page of the
 * backend's largest size, sorted by name.
 */
const REGISTRY_QUERY: HospitalListQuery = {
  page: 1,
  pageSize: MAX_PAGE_SIZE,
  q: '',
  statuses: [],
  planId: null,
  sort: 'name',
};

export function useComplianceHospitalsQuery() {
  return useHospitalsQuery(REGISTRY_QUERY);
}
