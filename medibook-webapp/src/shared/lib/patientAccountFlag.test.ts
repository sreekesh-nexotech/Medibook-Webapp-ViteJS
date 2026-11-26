import { describe, expect, it } from 'vitest';

import { PATIENT_FLAG_LABEL, parsePatientAccountFlag } from '@/shared/lib/patientAccountFlag';

describe('parsePatientAccountFlag', () => {
  it('accepts the two flags the server sends', () => {
    expect(parsePatientAccountFlag('blocked')).toBe('blocked');
    expect(parsePatientAccountFlag('pending_deletion')).toBe('pending_deletion');
  });

  it('treats null, absent and unknown values as no flag', () => {
    for (const v of [null, undefined, '', 'suspended', 'BLOCKED', 1, {}]) {
      expect(parsePatientAccountFlag(v)).toBeNull();
    }
  });

  it('has a label for every flag', () => {
    expect(PATIENT_FLAG_LABEL.blocked).toBe('Account blocked');
    expect(PATIENT_FLAG_LABEL.pending_deletion).toBe('Deletion pending');
  });
});
