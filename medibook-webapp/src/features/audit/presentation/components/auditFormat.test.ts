import { describe, expect, it } from 'vitest';

import {
  auditLogResponseSchema,
  toAuditLogEntry,
  toSnapshotFields,
} from '@/features/audit/infrastructure/data-sources/remote/audit.response';
import { entityCodeFor, entityLabel } from '@/features/audit/presentation/components/auditFormat';

describe('entityLabel (05 F19)', () => {
  it('names known entities and turns view classes into words', () => {
    expect(entityLabel('hospital_patient')).toBe('Patient record');
    expect(entityLabel('HospitalAppointmentRefundsView')).toBe('Appointment refunds');
    expect(entityLabel('HospitalCashSessionCloseView')).toBe('Cash session close');
    expect(entityLabel('some_new_type')).toBe('some new type');
  });

  it('maps the filter label back to the resource type', () => {
    expect(entityCodeFor('Patient change request')).toBe('patient_change_request');
    expect(entityCodeFor('All')).toBeUndefined();
  });
});

describe('audit row detail (UAT-66)', () => {
  it('keeps the masked before, after and meta for the drawer', () => {
    const entry = toAuditLogEntry(
      auditLogResponseSchema.parse({
        id: 'a-1',
        occurred_at: '2026-10-07T05:30:00Z',
        request_id: 'req-1',
        principal: 'hospital',
        actor_user_id: 'u-1',
        hospital_id: 'h-1',
        ip: '10.0.0.1',
        method: 'POST',
        path: '/api/v1/hospital/patient-approvals/cr-1/approve',
        action: 'hospital_patient.change_approved',
        resource_type: 'hospital_patient',
        resource_id: 'p-1',
        before: { phone_e164: '+91******10', city: null },
        after: { phone_e164: '+91******99', city: 'Kochi' },
        diff: { phone_e164: ['+91******10', '+91******99'] },
        status_code: 200,
        meta: { mrn: 'LKSM000043' },
      }),
    );
    expect(entry.before).toEqual([
      { field: 'phone_e164', value: '+91******10' },
      { field: 'city', value: null },
    ]);
    expect(entry.meta).toEqual([{ field: 'mrn', value: 'LKSM000043' }]);
    expect(entry.changes).toEqual([
      { field: 'phone_e164', before: '+91******10', after: '+91******99' },
    ]);
  });

  it('reads empty and bare snapshots safely', () => {
    expect(toSnapshotFields(null)).toEqual([]);
    expect(toSnapshotFields({})).toEqual([]);
    expect(toSnapshotFields(5)).toEqual([{ field: 'value', value: '5' }]);
    expect(toSnapshotFields({ list: [1, 2] })).toEqual([{ field: 'list', value: '[1,2]' }]);
  });
});
