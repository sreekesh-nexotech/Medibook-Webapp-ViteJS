import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  CommissionHistory,
  FirstAdminInvitation,
  FirstAdminResend,
  HospitalAppVisibility,
  HospitalCommissionChange,
  HospitalConvenienceFeeChange,
  HospitalCreateInput,
  HospitalProfileChanges,
  HospitalListQuery,
  HospitalStatusCounts,
  HospitalSuspendReason,
  PayoutBankAccount,
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
  /** Correct profile fields or switch online booking; `version` guards a concurrent edit. */
  updateHospital(
    id: string,
    changes: HospitalProfileChanges,
    version: number,
  ): Promise<Result<PlatformHospitalDetail>>;
  /** List or unlist the hospital in the patient app. */
  setVisibility(id: string, visibility: HospitalAppVisibility): Promise<Result<PlatformHospital>>;
  setCommission(id: string, change: HospitalCommissionChange): Promise<Result<PlatformHospital>>;
  setConvenienceFee(
    id: string,
    change: HospitalConvenienceFeeChange,
  ): Promise<Result<PlatformHospital>>;
  /** Re-send (or re-address) the first administrator's invitation (CORE-04). */
  resendAdminInvitation(
    id: string,
    resend: FirstAdminResend,
  ): Promise<Result<FirstAdminInvitation>>;
  /** Commission rates, scheduled first; `null` when the server has no history endpoint. */
  getCommissionHistory(id: string): Promise<Result<CommissionHistory | null>>;
  listBankAccounts(id: string): Promise<Result<readonly PayoutBankAccount[]>>;
  /** Platform finance records the account as verified (idempotent). */
  verifyBankAccount(
    id: string,
    accountId: string,
    version: number,
  ): Promise<Result<PayoutBankAccount>>;
}
