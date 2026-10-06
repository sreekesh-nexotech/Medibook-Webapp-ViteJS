import type { z } from 'zod';

import { idempotencyKey } from '@/core/api/headers';
import { platformApi } from '@/core/api/http';
import { MAX_PAGE_SIZE, paginatedSchema } from '@/core/api/pagination';

import type {
  ComplianceQueryParams,
  DataExportCreateRequest,
} from '@/features/ops-compliance/infrastructure/data-sources/remote/compliance.request';
import {
  configChangePageSchema,
  configChangeResponseSchema,
  dataRequestPageSchema,
  dataRequestResponseSchema,
  loginEventPageSchema,
  loginEventResponseSchema,
  type ConfigChangeResponse,
  type DataRequestResponse,
  type LoginEventResponse,
} from '@/features/ops-compliance/infrastructure/data-sources/remote/compliance.response';

const LOGIN_HISTORY_PATH = '/compliance/login-history';
const CONFIG_CHANGES_PATH = '/compliance/config-changes';
const DATA_REQUESTS_PATH = '/compliance/data-requests';

/** CSV exports stop after this many rows (50 pages) so one click cannot run unbounded. */
export const COMPLIANCE_EXPORT_MAX_ROWS = 5000;

/** Rows from walking a list, and whether the cap cut it short. */
interface WalkedRows<T> {
  readonly rows: T[];
  readonly truncated: boolean;
}

/** Walk every page of `path` (newest first) until the last page or the row cap. */
async function walkPages<T extends z.ZodType>(
  path: string,
  params: ComplianceQueryParams,
  item: T,
): Promise<WalkedRows<z.infer<T>>> {
  const pageSchema = paginatedSchema(item);
  const rows: z.infer<T>[] = [];
  for (let page = 1; ; page += 1) {
    const response = await platformApi.get(path, {
      params: { ...params, page, page_size: MAX_PAGE_SIZE, sort: '-occurred_at' },
    });
    const body = pageSchema.parse(response.data);
    rows.push(...body.results);
    if (!body.has_next) return { rows, truncated: false };
    if (rows.length >= COMPLIANCE_EXPORT_MAX_ROWS) {
      return { rows: rows.slice(0, COMPLIANCE_EXPORT_MAX_ROWS), truncated: true };
    }
  }
}

export async function getLoginHistory(params: ComplianceQueryParams) {
  const response = await platformApi.get(LOGIN_HISTORY_PATH, { params });
  return loginEventPageSchema.parse(response.data);
}

export function getAllLoginHistory(
  params: ComplianceQueryParams,
): Promise<WalkedRows<LoginEventResponse>> {
  return walkPages(LOGIN_HISTORY_PATH, params, loginEventResponseSchema);
}

export async function getConfigChanges(params: ComplianceQueryParams) {
  const response = await platformApi.get(CONFIG_CHANGES_PATH, { params });
  return configChangePageSchema.parse(response.data);
}

export function getAllConfigChanges(
  params: ComplianceQueryParams,
): Promise<WalkedRows<ConfigChangeResponse>> {
  return walkPages(CONFIG_CHANGES_PATH, params, configChangeResponseSchema);
}

export async function getDataRequests(page: number, pageSize: number) {
  const response = await platformApi.get(DATA_REQUESTS_PATH, {
    params: { page, page_size: pageSize, sort: '-requested_at' },
  });
  return dataRequestPageSchema.parse(response.data);
}

/** `POST /platform/compliance/data-requests` — idempotent on the caller's key. */
export async function postDataRequest(
  body: DataExportCreateRequest,
  key: string,
): Promise<DataRequestResponse> {
  const response = await platformApi.post(DATA_REQUESTS_PATH, body, {
    headers: idempotencyKey(key),
  });
  return dataRequestResponseSchema.parse(response.data);
}

export async function postProcessDataRequest(id: string): Promise<DataRequestResponse> {
  const response = await platformApi.post(
    `${DATA_REQUESTS_PATH}/${encodeURIComponent(id)}/process`,
    {},
  );
  return dataRequestResponseSchema.parse(response.data);
}

export async function postRejectDataRequest(
  id: string,
  reason: string,
): Promise<DataRequestResponse> {
  const response = await platformApi.post(
    `${DATA_REQUESTS_PATH}/${encodeURIComponent(id)}/reject`,
    { reason },
  );
  return dataRequestResponseSchema.parse(response.data);
}
