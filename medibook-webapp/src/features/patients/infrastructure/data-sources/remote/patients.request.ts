import type { PatientDemographics } from '@/features/patients/domain/entities/patients.entities';

/**
 * Request DTOs for `POST /hospital/patients` (`HospitalPatientCreateRequest`)
 * and `PATCH /hospital/patients/{id}` (`PatchedHospitalPatientEditRequest`).
 * Only keys present in the input are sent, so an edit carries just the fields
 * that changed (the backend rejects an edit with nothing to change, and with
 * D-29 approval on every key sent becomes part of the request).
 */

export interface PatientRequestBody {
  first_name?: string;
  last_name?: string | null;
  phone_e164?: string | null;
  email?: string | null;
  date_of_birth?: string | null;
  gender?: PatientDemographics['gender'];
  address_line1?: string | null;
  address_line2?: string | null;
  address_line3?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  legacy_mrn?: string | null;
}

/** Entity key → API key, for every demographic the desk can send. */
const REQUEST_KEYS: Readonly<Record<keyof PatientDemographics, keyof PatientRequestBody>> = {
  firstName: 'first_name',
  lastName: 'last_name',
  phone: 'phone_e164',
  email: 'email',
  dateOfBirth: 'date_of_birth',
  gender: 'gender',
  addressLine1: 'address_line1',
  addressLine2: 'address_line2',
  addressLine3: 'address_line3',
  city: 'city',
  state: 'state',
  pincode: 'pincode',
  legacyMrn: 'legacy_mrn',
};

export function toPatientRequestBody(input: Partial<PatientDemographics>): PatientRequestBody {
  const body: Record<string, unknown> = {};
  for (const [key, apiKey] of Object.entries(REQUEST_KEYS)) {
    const value = input[key as keyof PatientDemographics];
    if (value !== undefined) body[apiKey] = value;
  }
  return body as PatientRequestBody;
}
