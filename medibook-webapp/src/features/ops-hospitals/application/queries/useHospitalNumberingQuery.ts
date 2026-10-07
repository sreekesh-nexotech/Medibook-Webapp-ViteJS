import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { NumberingKind } from '@/features/ops-hospitals/domain/entities/hospitalSettings.entity';
import { hospitalsKeys } from '@/features/ops-hospitals/application/queries/hospitals.keys';
import { fetchHospitalNumbering } from '@/features/ops-hospitals/application/usecases/fetchHospitalNumbering';

/** One numbering series of a hospital (`hospitals.edit` reads it). */
export function useHospitalNumberingQuery(hospitalId: string, kind: NumberingKind, enabled = true) {
  return useQuery({
    queryKey: hospitalsKeys.numbering(hospitalId, kind),
    queryFn: async () => unwrap(await fetchHospitalNumbering(hospitalId, kind)),
    enabled,
  });
}
