import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  PatientAppointmentHistory,
  PatientChangeDecision,
  PatientCreateOutcome,
  PatientDemographics,
  PatientEditOutcome,
  PatientListParams,
  PatientRecord,
} from '@/features/patients/domain/entities/patients.entities';

/** The hospital's patient master (MRN records) and its change approvals. */
export interface PatientsRepository {
  listPatients(params: PatientListParams): Promise<Result<Page<PatientRecord>>>;
  /** The record with exactly this MRN; a `notFound` failure when there is none. */
  getPatientByMrn(mrn: string): Promise<Result<PatientRecord>>;
  /** Mints an MRN, or returns the existing record when the person is already registered. */
  createPatient(demographics: PatientDemographics): Promise<Result<PatientCreateOutcome>>;
  /** Applies at once, or becomes a change request when the hospital requires approval. */
  updatePatient(
    id: string,
    changes: Partial<PatientDemographics>,
    version: number,
  ): Promise<Result<PatientEditOutcome>>;
  /** The latest `limit` appointments, plus the total on record. */
  listPatientAppointments(id: string, limit: number): Promise<Result<PatientAppointmentHistory>>;
  approvePatientChange(requestId: string): Promise<Result<PatientChangeDecision>>;
  rejectPatientChange(requestId: string, note: string): Promise<Result<PatientChangeDecision>>;
}
