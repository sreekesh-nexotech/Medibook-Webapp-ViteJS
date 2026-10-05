import type { PatientDemographics } from '@/features/patients/domain/entities/patients.entities';

/**
 * Request DTOs for `POST /hospital/patients` (`HospitalPatientCreateRequest`)
 * and `PATCH /hospital/patients/{id}` (`PatchedHospitalPatientEditRequest`).
 * Only keys present in the input are sent, so an edit carries just the fields
 * that changed (the backend rejects an edit with nothing to change).
 */

export interface PatientRequestBody {
  first_name?: string;
  last_name?: string | null;
  phone_e164?: string | null;
  email?: string | null;
  date_of_birth?: string | null;
  gender?: PatientDemographics['gender'];
  address_line1?: string | null;
}

export function toPatientRequestBody(input: Partial<PatientDemographics>): PatientRequestBody {
  const body: PatientRequestBody = {};
  if (input.firstName !== undefined) body.first_name = input.firstName;
  if (input.lastName !== undefined) body.last_name = input.lastName;
  if (input.phone !== undefined) body.phone_e164 = input.phone;
  if (input.email !== undefined) body.email = input.email;
  if (input.dateOfBirth !== undefined) body.date_of_birth = input.dateOfBirth;
  if (input.gender !== undefined) body.gender = input.gender;
  if (input.addressLine1 !== undefined) body.address_line1 = input.addressLine1;
  return body;
}
