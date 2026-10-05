import type {
  ComplianceDateRange,
  ConfigChangeFilters,
  ConfigChangeParams,
  DataExportDraft,
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
    ...(filters.principal ? { principal: filters.principal } : {}),
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
