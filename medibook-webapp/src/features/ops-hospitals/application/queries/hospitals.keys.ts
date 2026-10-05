import type { HospitalListQuery } from '@/features/ops-hospitals/domain/entities/hospitals.entity';

/** Query keys for the platform hospital registry. */
export const hospitalsKeys = {
  all: ['ops-hospitals'] as const,
  lists: () => [...hospitalsKeys.all, 'list'] as const,
  list: (query: HospitalListQuery) => [...hospitalsKeys.lists(), query] as const,
  counts: () => [...hospitalsKeys.all, 'counts'] as const,
  details: () => [...hospitalsKeys.all, 'detail'] as const,
  detail: (id: string) => [...hospitalsKeys.details(), id] as const,
};
