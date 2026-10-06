import type { QueryClient } from '@tanstack/react-query';

import type {
  HospitalListQuery,
  PlatformHospital,
  PlatformHospitalDetail,
} from '@/features/ops-hospitals/domain/entities/hospitals.entity';

/** Query keys for the platform hospital registry. */
export const hospitalsKeys = {
  all: ['ops-hospitals'] as const,
  lists: () => [...hospitalsKeys.all, 'list'] as const,
  list: (query: HospitalListQuery) => [...hospitalsKeys.lists(), query] as const,
  counts: () => [...hospitalsKeys.all, 'counts'] as const,
  details: () => [...hospitalsKeys.all, 'detail'] as const,
  detail: (id: string) => [...hospitalsKeys.details(), id] as const,
};

/**
 * Write a hospital the server just returned over its cached detail, so a
 * second edit sends the new `version` (`If-Match`) before the refetch lands.
 */
export function mergeHospitalDetail(queryClient: QueryClient, hospital: PlatformHospital): void {
  queryClient.setQueryData<PlatformHospitalDetail>(hospitalsKeys.detail(hospital.id), (old) =>
    old ? { ...old, ...hospital } : old,
  );
}
