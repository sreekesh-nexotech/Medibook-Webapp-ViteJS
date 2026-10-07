import { ifMatch } from '@/core/api/headers';
import { hospitalApi } from '@/core/api/http';
import { MAX_PAGE_SIZE } from '@/core/api/pagination';
import { withQueryParamFallback } from '@/core/api/queryParams';

import type {
  PatientApprovalListParams,
  PatientListParams,
} from '@/features/patients/domain/entities/patients.entities';
import type { PatientRequestBody } from '@/features/patients/infrastructure/data-sources/remote/patients.request';
import {
  approvalRequestPageResponseSchema,
  approvalRequestResponseSchema,
  changeRequestedResponseSchema,
  hospitalPatientPageResponseSchema,
  hospitalPatientResponseSchema,
  patientAppointmentPageResponseSchema,
} from '@/features/patients/infrastructure/data-sources/remote/patients.response';

/** `/hospital/patients…` and `/hospital/patient-approvals…` (`schema.yml`). */

const PATIENTS_PATH = '/patients';
const APPROVALS_PATH = '/patient-approvals';

const HTTP_CREATED = 201;
const HTTP_ACCEPTED = 202;

/** The exact-MRN filter (backend B6); older backends answer it as an unknown parameter. */
const MRN_PARAM = 'mrn';

/** The backend's sort grammar: `field` ascending, `-field` descending. */
function sortParam(params: PatientListParams): string {
  return params.sortDirection === 'desc' ? `-${params.sortField}` : params.sortField;
}

export async function getPatients(params: PatientListParams) {
  const response = await hospitalApi.get(PATIENTS_PATH, {
    params: {
      page: params.page,
      page_size: params.pageSize,
      sort: sortParam(params),
      q: params.q || undefined,
      source: params.source ?? undefined,
    },
  });
  return hospitalPatientPageResponseSchema.parse(response.data);
}

/**
 * Records with exactly this MRN: the exact `?mrn=` filter where the backend
 * has it, else the fuzzy search with the widest page (the caller then picks
 * the exact match), so an exact match is never cut off.
 */
export async function searchPatientsByMrn(mrn: string) {
  return withQueryParamFallback(
    MRN_PARAM,
    async () => {
      const response = await hospitalApi.get(PATIENTS_PATH, {
        params: { [MRN_PARAM]: mrn, page_size: MAX_PAGE_SIZE },
      });
      return hospitalPatientPageResponseSchema.parse(response.data);
    },
    async () => {
      const response = await hospitalApi.get(PATIENTS_PATH, {
        params: { q: mrn, page_size: MAX_PAGE_SIZE },
      });
      return hospitalPatientPageResponseSchema.parse(response.data);
    },
  );
}

export async function getPatient(id: string) {
  const response = await hospitalApi.get(`${PATIENTS_PATH}/${encodeURIComponent(id)}`);
  return hospitalPatientResponseSchema.parse(response.data);
}

/** `201` = new MRN minted; `200` = the same person was already registered here. */
export async function postPatient(body: PatientRequestBody) {
  const response = await hospitalApi.post(PATIENTS_PATH, body);
  return {
    isCreated: response.status === HTTP_CREATED,
    patient: hospitalPatientResponseSchema.parse(response.data),
  };
}

/** `200` = applied (the record); `202` = sent to an admin for approval. */
export async function patchPatient(id: string, body: PatientRequestBody, version: number) {
  const response = await hospitalApi.patch(`${PATIENTS_PATH}/${encodeURIComponent(id)}`, body, {
    headers: ifMatch(version),
  });
  if (response.status === HTTP_ACCEPTED) {
    return {
      kind: 'requested' as const,
      request: changeRequestedResponseSchema.parse(response.data),
    };
  }
  return { kind: 'applied' as const, patient: hospitalPatientResponseSchema.parse(response.data) };
}

/**
 * `204` = soft-deleted; `202` = sent to an admin for approval (D-29). The
 * backend refuses a record with live bookings (`409 PERSON_HAS_APPOINTMENTS`).
 */
export async function deletePatient(id: string, version: number) {
  const response = await hospitalApi.delete(`${PATIENTS_PATH}/${encodeURIComponent(id)}`, {
    headers: ifMatch(version),
  });
  if (response.status === HTTP_ACCEPTED) {
    return {
      kind: 'requested' as const,
      request: changeRequestedResponseSchema.parse(response.data),
    };
  }
  return { kind: 'deleted' as const };
}

/** `status` narrows to those appointment statuses (comma-separated, `core/filters.py`). */
export async function getPatientAppointments(
  id: string,
  pageSize: number,
  statuses: readonly string[] = [],
) {
  const response = await hospitalApi.get(
    `${PATIENTS_PATH}/${encodeURIComponent(id)}/appointments`,
    {
      params: {
        page_size: pageSize,
        status: statuses.length > 0 ? statuses.join(',') : undefined,
      },
    },
  );
  return patientAppointmentPageResponseSchema.parse(response.data);
}

export async function postApprovalDecision(
  requestId: string,
  decision: 'approve' | 'reject',
  note: string | null,
) {
  const response = await hospitalApi.post(
    `${APPROVALS_PATH}/${encodeURIComponent(requestId)}/${encodeURIComponent(decision)}`,
    { note },
  );
  return approvalRequestResponseSchema.parse(response.data);
}

/** `GET /hospital/patient-approvals` — one page of the queue, newest request first. */
export async function getApprovals(params: PatientApprovalListParams) {
  const response = await hospitalApi.get(APPROVALS_PATH, {
    params: {
      page: params.page,
      page_size: params.pageSize,
      sort: '-requested_at',
      status: params.statuses.length > 0 ? params.statuses.join(',') : undefined,
      kind: params.kind ?? undefined,
    },
  });
  return approvalRequestPageResponseSchema.parse(response.data);
}
