import { describe, expect, it } from 'vitest';

import { toPatientRequestBody } from '@/features/patients/infrastructure/data-sources/remote/patients.request';
import {
  approvalRequestPageResponseSchema,
  hospitalPatientResponseSchema,
  toFieldChanges,
  toPatientApproval,
  toPatientRecord,
} from '@/features/patients/infrastructure/data-sources/remote/patients.response';

/** An `ApprovalRequestSerializer` row, shaped as the backend builds it. */
const APPROVAL_ROW = {
  id: 'cr-1',
  kind: 'edit',
  status: 'pending',
  proposed: {
    changes: { phone_e164: '+919999999999', date_of_birth: '1990-04-02' },
    before: { phone_e164: '+919876543210', date_of_birth: null },
    base_version: 3,
  },
  hospital_patient: { id: 'p-1', mrn: 'LKSM000043', full_name: 'Mary Thomas', deleted: false },
  requested_by_name: 'Vineeth Kumar',
  requested_at: '2026-10-07T05:30:00Z',
  reviewed_by_name: null,
  reviewed_at: null,
  review_note: null,
  created_at: '2026-10-07T05:30:00Z',
};

describe('toFieldChanges', () => {
  it('pairs each proposed value with the value it replaces', () => {
    expect(toFieldChanges(APPROVAL_ROW.proposed)).toEqual([
      { field: 'phone_e164', before: '+919876543210', after: '+919999999999' },
      { field: 'date_of_birth', before: null, after: '1990-04-02' },
    ]);
  });

  it('has nothing to show for a delete request', () => {
    expect(toFieldChanges({ base_version: 3, mrn: 'LKSM000043', full_name: 'X' })).toEqual([]);
  });
});

describe('approvals queue rows', () => {
  it('parse and map, with the requester and old → new values', () => {
    const page = approvalRequestPageResponseSchema.parse({
      results: [APPROVAL_ROW],
      page: 1,
      page_size: 25,
      total: 1,
      has_next: false,
    });
    const [first] = page.results;
    if (!first) throw new Error('the page should hold the row');
    const row = toPatientApproval(first);
    expect(row.patient).toEqual({
      id: 'p-1',
      mrn: 'LKSM000043',
      fullName: 'Mary Thomas',
      isDeleted: false,
    });
    expect(row.requestedByName).toBe('Vineeth Kumar');
    expect(row.requestedByUserId).toBeNull();
    expect(row.changes).toHaveLength(2);
  });

  it('read the requester id when the backend sends one', () => {
    const row = toPatientApproval(
      approvalRequestPageResponseSchema.shape.results.element.parse({
        ...APPROVAL_ROW,
        requested_by_user_id: 'u-9',
      }),
    );
    expect(row.requestedByUserId).toBe('u-9');
  });
});

describe('patient record', () => {
  it('carries the pending request’s values and requester (B6)', () => {
    const record = toPatientRecord(
      hospitalPatientResponseSchema.parse({
        id: 'p-1',
        mrn: 'LKSM000043',
        legacy_mrn: 'OLD-77',
        first_name: 'Mary',
        last_name: 'Thomas',
        full_name: 'Mary Thomas',
        phone_e164: '+919876543210',
        email: null,
        date_of_birth: null,
        gender: null,
        address_line1: null,
        address_line2: null,
        address_line3: null,
        city: null,
        state: null,
        pincode: null,
        source: 'desk',
        is_linked: false,
        pending_request: {
          id: 'cr-1',
          kind: 'edit',
          requested_at: '2026-10-07T05:30:00Z',
          proposed: APPROVAL_ROW.proposed,
          requested_by_name: 'Vineeth Kumar',
          requested_by_id: 'u-5',
        },
        created_at: '2026-10-01T09:00:00Z',
        version: 3,
      }),
    );
    expect(record.legacyMrn).toBe('OLD-77');
    expect(record.pendingChange?.changedFields).toEqual(['phone_e164', 'date_of_birth']);
    expect(record.pendingChange?.requestedByName).toBe('Vineeth Kumar');
    expect(record.pendingChange?.requestedByUserId).toBe('u-5');
  });
});

describe('toPatientRequestBody', () => {
  it('sends only the keys present, under their API names', () => {
    expect(toPatientRequestBody({ phone: '+919999999999' })).toEqual({
      phone_e164: '+919999999999',
    });
    expect(
      toPatientRequestBody({ city: null, legacyMrn: 'OLD-77', addressLine3: 'Near X' }),
    ).toEqual({ city: null, legacy_mrn: 'OLD-77', address_line3: 'Near X' });
  });
});
