import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  HospitalCreateInput,
  HospitalListQuery,
  HospitalStatusCounts,
  HospitalSuspendReason,
  PlatformHospital,
  PlatformHospitalDetail,
} from '@/features/ops-hospitals/domain/entities/hospitals.entity';

/** The platform hospital registry (`/platform/hospitals`). */
export interface HospitalsRepository {
  listHospitals(query: HospitalListQuery): Promise<Result<Page<PlatformHospital>>>;
  statusCounts(): Promise<Result<HospitalStatusCounts>>;
  getHospital(id: string): Promise<Result<PlatformHospitalDetail>>;
  createHospital(input: HospitalCreateInput): Promise<Result<PlatformHospital>>;
  suspendHospital(
    id: string,
    reason: HospitalSuspendReason,
    note: string | null,
  ): Promise<Result<PlatformHospital>>;
  reinstateHospital(id: string): Promise<Result<PlatformHospital>>;
}
