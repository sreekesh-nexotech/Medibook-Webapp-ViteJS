import { toPage } from '@/core/api/pagination';
import { attempt } from '@/core/error/attempt';
import { clientFailure } from '@/core/error/toFailure';

import type { PatientCreateOutcome } from '@/features/patients/domain/entities/patients.entities';
import type { PatientsRepository } from '@/features/patients/domain/repositories/patients.repository';
import {
  deletePatient,
  getApprovals,
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
  toPatientApproval,
  toPatientAppointment,
  toPatientChangeDecision,
  toPatientMatchCandidate,
  toPatientRecord,
} from '@/features/patients/infrastructure/data-sources/remote/patients.response';

const PATIENT_NOT_FOUND = 'No patient with this MR number exists at this hospital.';

/** `AppointmentStatus` of a consultation that took place. */
const COMPLETED_STATUS = 'completed';

/** A count needs only the `total`, so the page holds one row. */
const COUNT_PAGE_SIZE = 1;

export const patientsRepository: PatientsRepository = {
  listPatients: (params) => attempt(async () => toPage(await getPatients(params), toPatientRecord)),

  // The route carries the MRN; the API is keyed by UUID. Resolve it through
  // the exact MRN filter (or, on an older backend, the search, which also
  // matches partial MRNs), then read the detail, which is the only read that
  // carries the pending change request.
  getPatientByMrn: (mrn) =>
    attempt(async () => {
      const wanted = mrn.trim().toUpperCase();
      const page = await searchPatientsByMrn(wanted);
      const hit = page.results.find((row) => row.mrn.toUpperCase() === wanted);
      if (!hit) throw clientFailure('notFound', PATIENT_NOT_FOUND);
      return toPatientRecord(await getPatient(hit.id));
    }),

  createPatient: ({ demographics, confirmNewRecord }) =>
    attempt(async (): Promise<PatientCreateOutcome> => {
      const answer = await postPatient(toPatientRequestBody(demographics), confirmNewRecord);
      return answer.kind === 'matchReview'
        ? { status: 'matchReview', candidates: answer.candidates.map(toPatientMatchCandidate) }
        : { status: answer.kind, patient: toPatientRecord(answer.patient) };
    }),

  updatePatient: (id, changes, version) =>
    attempt(async () => {
      const outcome = await patchPatient(id, toPatientRequestBody(changes), version);
      return outcome.kind === 'requested'
        ? { status: 'pendingApproval' as const, requestId: outcome.request.request_id }
        : { status: 'applied' as const, patient: toPatientRecord(outcome.patient) };
    }),

  deletePatient: (id, version) =>
    attempt(async () => {
      const outcome = await deletePatient(id, version);
      return outcome.kind === 'requested'
        ? { status: 'pendingApproval' as const, requestId: outcome.request.request_id }
        : { status: 'deleted' as const };
    }),

  listApprovals: (params) =>
    attempt(async () => toPage(await getApprovals(params), toPatientApproval)),

  // Cancelled, no-show and upcoming bookings are not visits.
  countCompletedVisits: (id) =>
    attempt(
      async () => (await getPatientAppointments(id, COUNT_PAGE_SIZE, [COMPLETED_STATUS])).total,
    ),

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
