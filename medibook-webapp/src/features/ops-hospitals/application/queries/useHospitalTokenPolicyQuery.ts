import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { hospitalsKeys } from '@/features/ops-hospitals/application/queries/hospitals.keys';
import { fetchHospitalTokenPolicy } from '@/features/ops-hospitals/application/usecases/fetchHospitalTokenPolicy';

/** A hospital's token policy (`hospitals.edit` reads it). */
export function useHospitalTokenPolicyQuery(hospitalId: string, enabled = true) {
  return useQuery({
    queryKey: hospitalsKeys.tokenPolicy(hospitalId),
    queryFn: async () => unwrap(await fetchHospitalTokenPolicy(hospitalId)),
    enabled,
  });
}
