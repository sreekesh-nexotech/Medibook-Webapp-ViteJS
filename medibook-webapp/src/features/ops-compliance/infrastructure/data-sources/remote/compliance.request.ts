import type {
  ComplianceDateRange,
  ConfigChangeFilters,
  ConfigChangeParams,
  DataExportDraft,
  DataRequestParams,
  LoginHistoryFilters,
  LoginHistoryParams,
} from '@/features/ops-compliance/domain/entities/compliance.entities';

/** Query params the compliance lists accept; absent filters are omitted. */
export type ComplianceQueryParams = Readonly<Record<string, string | number>>;

/** `DataSubjectRequestCreateRequest` (`schema.yml`). */
export interface DataExportCreateRequest {
  readonly subject_user_id: string;
  readonly kind: 'export';
  readonly subject_kind: string;
}

function dateParams(range: ComplianceDateRange): ComplianceQueryParams {
  return {
    ...(range.dateFrom ? { date_from: range.dateFrom } : {}),
    ...(range.dateTo ? { date_to: range.dateTo } : {}),
  };
}

function sortParam(field: string, direction: 'asc' | 'desc'): string {
  return `${direction === 'desc' ? '-' : ''}${field}`;
}

export function toLoginFilterParams(filters: LoginHistoryFilters): ComplianceQueryParams {
  return {
    ...dateParams(filters),
    ...(filters.result ? { result: filters.result } : {}),
    ...(filters.hospitalId ? { hospital_id: filters.hospitalId } : {}),
    // One surface is valid on every backend; several need B6's multi-value `principal`.
    ...(filters.principals.length > 0 ? { principal: filters.principals.join(',') } : {}),
  };
}

export function toLoginHistoryParams(params: LoginHistoryParams): ComplianceQueryParams {
  return {
    ...toLoginFilterParams(params),
    page: params.page,
    page_size: params.pageSize,
    sort: sortParam('occurred_at', params.sortDirection),
  };
}

export function toConfigFilterParams(filters: ConfigChangeFilters): ComplianceQueryParams {
  return {
    ...dateParams(filters),
    ...(filters.scope ? { scope: filters.scope } : {}),
    ...(filters.settingKeyPrefix ? { setting_key_prefix: filters.settingKeyPrefix } : {}),
    ...(filters.hospitalId ? { hospital_id: filters.hospitalId } : {}),
  };
}

/** `GET /platform/compliance/data-requests` params (`status` is multi-value on the backend). */
export function toDataRequestParams(params: DataRequestParams): ComplianceQueryParams {
  return {
    page: params.page,
    page_size: params.pageSize,
    sort: '-requested_at',
    ...(params.statuses.length > 0 ? { status: params.statuses.join(',') } : {}),
    ...(params.kind ? { kind: params.kind } : {}),
    ...(params.subjectKind ? { subject_kind: params.subjectKind } : {}),
    // B6 filters: sent only when used, so an older backend still answers the rest.
    ...(params.requestNo?.trim() ? { request_no: params.requestNo.trim().toUpperCase() } : {}),
    ...(params.dateFrom ? { date_from: params.dateFrom } : {}),
    ...(params.dateTo ? { date_to: params.dateTo } : {}),
  };
}

export function toConfigChangeParams(params: ConfigChangeParams): ComplianceQueryParams {
  return {
    ...toConfigFilterParams(params),
    page: params.page,
    page_size: params.pageSize,
    sort: sortParam(params.sortField, params.sortDirection),
  };
}

export function toDataExportCreateRequest(draft: DataExportDraft): DataExportCreateRequest {
  return { subject_user_id: draft.subjectUserId, kind: 'export', subject_kind: draft.subjectKind };
}
