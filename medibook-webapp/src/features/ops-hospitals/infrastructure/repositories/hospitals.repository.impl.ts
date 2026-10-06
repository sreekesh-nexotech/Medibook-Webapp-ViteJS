import { toPage } from '@/core/api/pagination';
import { attempt } from '@/core/error/attempt';

import type { HospitalsRepository } from '@/features/ops-hospitals/domain/repositories/hospitals.repository';
import {
  countHospitals,
  getHospital,
  getHospitals,
  patchHospital,
  postHospital,
  postReinstateHospital,
  postSetCommission,
  postSetConvenienceFee,
  postSetVisibility,
  postSuspendHospital,
} from '@/features/ops-hospitals/infrastructure/data-sources/remote/hospitals.api';
import { toHospitalPatchRequest } from '@/features/ops-hospitals/infrastructure/data-sources/remote/hospitals.request';
import {
  toPlatformHospital,
  toPlatformHospitalDetail,
} from '@/features/ops-hospitals/infrastructure/data-sources/remote/hospitals.response';

export const hospitalsRepository: HospitalsRepository = {
  listHospitals: (query) =>
    attempt(async () => toPage(await getHospitals(query), toPlatformHospital)),

  statusCounts: () =>
    attempt(async () => {
      const [total, active, pending, suspended] = await Promise.all([
        countHospitals([]),
        countHospitals(['active']),
        countHospitals(['draft', 'onboarding']),
        countHospitals(['suspended']),
      ]);
      return { total, active, pending, suspended };
    }),

  getHospital: (id) => attempt(async () => toPlatformHospitalDetail(await getHospital(id))),

  createHospital: (input) => attempt(async () => toPlatformHospital(await postHospital(input))),

  suspendHospital: (id, reason, note) =>
    attempt(async () => toPlatformHospital(await postSuspendHospital(id, reason, note))),

  reinstateHospital: (id) =>
    attempt(async () => toPlatformHospital(await postReinstateHospital(id))),

  updateHospital: (id, changes, version) =>
    attempt(async () =>
      toPlatformHospitalDetail(await patchHospital(id, toHospitalPatchRequest(changes), version)),
    ),

  setVisibility: (id, visibility) =>
    attempt(async () => toPlatformHospital(await postSetVisibility(id, visibility))),

  setCommission: (id, change) =>
    attempt(async () => toPlatformHospital(await postSetCommission(id, change))),

  setConvenienceFee: (id, change) =>
    attempt(async () => toPlatformHospital(await postSetConvenienceFee(id, change))),
};
