import { toPage } from '@/core/api/pagination';
import { attempt } from '@/core/error/attempt';
import { clientFailure } from '@/core/error/toFailure';

import type { PatientsRepository } from '@/features/patients/domain/repositories/patients.repository';
import {
  getPatient,
  getPatientAppointments,
  getPatients,
  patchPatient,
  postApprovalDecision,
  postPatient,
  searchPatientsByMrn,
} from '@/features/patients/infrastructure/data-sources/remote/patients.api';
import { toPatientRequestBody } from '@/features/patients/infrastructure/data-sources/remote/patients.request';
import {
  toPatientAppointment,
  toPatientChangeDecision,
  toPatientRecord,
} from '@/features/patients/infrastructure/data-sources/remote/patients.response';

const PATIENT_NOT_FOUND = 'No patient with this MR number exists at this hospital.';

export const patientsRepository: PatientsRepository = {
  listPatients: (params) => attempt(async () => toPage(await getPatients(params), toPatientRecord)),

  // The route carries the MRN; the API is keyed by UUID. Resolve it through
  // the search (which also matches partial MRNs), then read the detail, which
  // is the only read that carries the pending change request.
  getPatientByMrn: (mrn) =>
    attempt(async () => {
      const wanted = mrn.trim().toUpperCase();
      const page = await searchPatientsByMrn(wanted);
      const hit = page.results.find((row) => row.mrn.toUpperCase() === wanted);
      if (!hit) throw clientFailure('notFound', PATIENT_NOT_FOUND);
      return toPatientRecord(await getPatient(hit.id));
    }),

  createPatient: (demographics) =>
    attempt(async () => {
      const { isCreated, patient } = await postPatient(toPatientRequestBody(demographics));
      return { patient: toPatientRecord(patient), isExisting: !isCreated };
    }),

  updatePatient: (id, changes, version) =>
    attempt(async () => {
      const outcome = await patchPatient(id, toPatientRequestBody(changes), version);
      return outcome.kind === 'requested'
        ? { status: 'pendingApproval' as const, requestId: outcome.request.request_id }
        : { status: 'applied' as const, patient: toPatientRecord(outcome.patient) };
    }),

  listPatientAppointments: (id, limit) =>
    attempt(async () => {
      const page = await getPatientAppointments(id, limit);
      return { items: page.results.map(toPatientAppointment), total: page.total };
    }),

  approvePatientChange: (requestId) =>
    attempt(async () =>
      toPatientChangeDecision(await postApprovalDecision(requestId, 'approve', null)),
    ),

  rejectPatientChange: (requestId, note) =>
    attempt(async () =>
      toPatientChangeDecision(await postApprovalDecision(requestId, 'reject', note)),
    ),
};
