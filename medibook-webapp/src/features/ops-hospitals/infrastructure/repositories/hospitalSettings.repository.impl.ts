import { attempt } from '@/core/error/attempt';

import type { HospitalSettingsRepository } from '@/features/ops-hospitals/domain/repositories/hospitalSettings.repository';
import {
  getNumbering,
  getTokenPolicy,
  putNumbering,
  putTokenPolicy,
} from '@/features/ops-hospitals/infrastructure/data-sources/remote/hospitalSettings.api';
import {
  toNumberingSeries,
  toTokenPolicy,
} from '@/features/ops-hospitals/infrastructure/data-sources/remote/hospitalSettings.response';

export const hospitalSettingsRepository: HospitalSettingsRepository = {
  getNumbering: (hospitalId, kind) =>
    attempt(async () => toNumberingSeries(await getNumbering(hospitalId, kind))),
  updateNumbering: (hospitalId, kind, change, version) =>
    attempt(async () => toNumberingSeries(await putNumbering(hospitalId, kind, change, version))),
  getTokenPolicy: (hospitalId) =>
    attempt(async () => toTokenPolicy(await getTokenPolicy(hospitalId))),
  updateTokenPolicy: (hospitalId, change, version) =>
    attempt(async () => toTokenPolicy(await putTokenPolicy(hospitalId, change, version))),
};
