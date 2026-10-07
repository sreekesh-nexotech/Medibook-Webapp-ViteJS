import { toPage } from '@/core/api/pagination';
import { attempt } from '@/core/error/attempt';
import { err, ok } from '@/core/error/failure';

import type { ComplianceRepository } from '@/features/ops-compliance/domain/repositories/compliance.repository';
import {
  getAllConfigChanges,
  getAllLoginHistory,
  getConfigChanges,
  getDataRequest,
  getDataRequests,
  getLoginHistory,
  postDataRequest,
  postProcessDataRequest,
  postRejectDataRequest,
} from '@/features/ops-compliance/infrastructure/data-sources/remote/compliance.api';
import {
  toConfigChangeParams,
  toConfigFilterParams,
  toDataExportCreateRequest,
  toDataRequestParams,
  toLoginFilterParams,
  toLoginHistoryParams,
} from '@/features/ops-compliance/infrastructure/data-sources/remote/compliance.request';
import {
  toConfigChange,
  toDataRequest,
  toLoginEvent,
} from '@/features/ops-compliance/infrastructure/data-sources/remote/compliance.response';

/** The backend answers 501 when the export renderer only runs in the nightly worker. */
const HTTP_NOT_IMPLEMENTED = 501;

export const complianceRepository: ComplianceRepository = {
  listLoginHistory: (params) =>
    attempt(async () => toPage(await getLoginHistory(toLoginHistoryParams(params)), toLoginEvent)),

  exportLoginHistory: (filters) =>
    attempt(async () => {
      const walked = await getAllLoginHistory(toLoginFilterParams(filters));
      return { rows: walked.rows.map(toLoginEvent), truncated: walked.truncated };
    }),

  listConfigChanges: (params) =>
    attempt(async () =>
      toPage(await getConfigChanges(toConfigChangeParams(params)), toConfigChange),
    ),

  exportConfigChanges: (filters) =>
    attempt(async () => {
      const walked = await getAllConfigChanges(toConfigFilterParams(filters));
      return { rows: walked.rows.map(toConfigChange), truncated: walked.truncated };
    }),

  listDataRequests: (params) =>
    attempt(async () => toPage(await getDataRequests(toDataRequestParams(params)), toDataRequest)),

  getDataRequest: (id) => attempt(async () => toDataRequest(await getDataRequest(id))),

  createDataExport: (draft) =>
    attempt(async () =>
      toDataRequest(await postDataRequest(toDataExportCreateRequest(draft), draft.idempotencyKey)),
    ),

  processDataRequest: async (id, notes) => {
    const result = await attempt(async () =>
      toDataRequest(await postProcessDataRequest(id, notes)),
    );
    if (result.ok) return ok({ status: 'processed', request: result.data });
    if (result.failure.status === HTTP_NOT_IMPLEMENTED) return ok({ status: 'deferred' });
    return err(result.failure);
  },

  rejectDataRequest: (id, reason) =>
    attempt(async () => toDataRequest(await postRejectDataRequest(id, reason))),
};
