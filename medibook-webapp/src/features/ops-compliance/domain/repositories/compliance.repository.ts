import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  ComplianceExportRows,
  ConfigChangeFilters,
  ConfigChangeParams,
  ConfigChangeRecord,
  DataExportDraft,
  DataRequest,
  DataRequestParams,
  DataRequestProcessOutcome,
  LoginEvent,
  LoginHistoryFilters,
  LoginHistoryParams,
  PhiAccessEntry,
  PhiAccessParams,
  StaffDirectoryEntry,
} from '@/features/ops-compliance/domain/entities/compliance.entities';

/** The platform's compliance records. */
export interface ComplianceRepository {
  listLoginHistory(params: LoginHistoryParams): Promise<Result<Page<LoginEvent>>>;
  /** Every sign-in matching `filters`, newest first, up to the export cap. */
  exportLoginHistory(
    filters: LoginHistoryFilters,
  ): Promise<Result<ComplianceExportRows<LoginEvent>>>;
  listConfigChanges(params: ConfigChangeParams): Promise<Result<Page<ConfigChangeRecord>>>;
  /** Every change matching `filters`, newest first, up to the export cap. */
  exportConfigChanges(
    filters: ConfigChangeFilters,
  ): Promise<Result<ComplianceExportRows<ConfigChangeRecord>>>;
  listDataRequests(params: DataRequestParams): Promise<Result<Page<DataRequest>>>;
  /** One request in full (notes, carve-out, cooling-off end). */
  getDataRequest(id: string): Promise<Result<DataRequest>>;
  /** File an export request for one account. */
  createDataExport(draft: DataExportDraft): Promise<Result<DataRequest>>;
  /**
   * Prepare a filed request's export now (or report that the nightly run
   * will), or complete a rectification with `notes` on what was corrected.
   */
  processDataRequest(id: string, notes?: string): Promise<Result<DataRequestProcessOutcome>>;
  rejectDataRequest(id: string, reason: string): Promise<Result<DataRequest>>;
  /** One page of the PHI read audit (B6). */
  listPhiAccess(params: PhiAccessParams): Promise<Result<Page<PhiAccessEntry>>>;
  /** Hospital staff accounts matching a name, email, phone or employee code (B9). */
  findHospitalStaff(q: string): Promise<Result<StaffDirectoryEntry[]>>;
}
