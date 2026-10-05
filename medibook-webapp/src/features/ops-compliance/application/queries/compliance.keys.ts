import type {
  ConfigChangeParams,
  DataRequestParams,
  LoginHistoryParams,
} from '@/features/ops-compliance/domain/entities/compliance.entities';

/** Query keys for the compliance screen. */
export const complianceKeys = {
  all: ['ops-compliance'] as const,
  logins: () => [...complianceKeys.all, 'logins'] as const,
  loginPage: (params: LoginHistoryParams) => [...complianceKeys.logins(), params] as const,
  changes: () => [...complianceKeys.all, 'config-changes'] as const,
  changePage: (params: ConfigChangeParams) => [...complianceKeys.changes(), params] as const,
  requests: () => [...complianceKeys.all, 'data-requests'] as const,
  requestPage: (params: DataRequestParams) => [...complianceKeys.requests(), params] as const,
};
