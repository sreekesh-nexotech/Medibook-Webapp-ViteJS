/**
 * The state of the patient's Medibook account that the desk should know about
 * (UAT part 2, T10/T12/T16). Information only: the desk can still serve these
 * patients, so nothing is ever disabled because of a flag.
 */
export type PatientAccountFlag = 'blocked' | 'pending_deletion';

/** Reads the server's `patient_account_flag`; anything unknown or absent is no flag. */
export function parsePatientAccountFlag(value: unknown): PatientAccountFlag | null {
  return value === 'blocked' || value === 'pending_deletion' ? value : null;
}

export const PATIENT_FLAG_LABEL: Readonly<Record<PatientAccountFlag, string>> = {
  blocked: 'Account blocked',
  pending_deletion: 'Deletion pending',
};

/** Why the desk is told, for the badge tooltip. */
export const PATIENT_FLAG_HINT: Readonly<Record<PatientAccountFlag, string>> = {
  blocked:
    'Medibook has blocked this patient’s account. You can still serve this booking at the desk.',
  pending_deletion:
    'This patient has asked to delete their account. You can still serve this booking at the desk.',
};
