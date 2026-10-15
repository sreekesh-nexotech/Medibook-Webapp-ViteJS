import { describe, expect, it } from 'vitest';

import recorded from '@/test/contract/fixtures/appointments.receiptResponseSchema.json';
import {
  receiptResponseSchema,
  snapshotAddress,
  toReceipt,
} from '@/features/appointments/infrastructure/data-sources/remote/appointments.response';

describe('receipt for print (UAT-64)', () => {
  it('carries the hospital address and the Medibook supplier block', () => {
    const receipt = toReceipt(receiptResponseSchema.parse(recorded));
    expect(receipt.hospitalAddress).toBe(
      'NH 66 Bypass, Maradu, Near Vyttila Hub, Kochi, Kerala 682040',
    );
    expect(receipt.hospitalLegalName).toBe('Lakeshore Healthcare Pvt Ltd');
    expect(receipt.platform).toEqual({
      legalName: 'Medibook Health Technologies Pvt Ltd',
      gstin: '00AAAAA0000A0A0',
      address: '4th Floor, Infopark Phase 2, Kochi, Kerala 682042',
    });
    expect(receipt.lines[0]?.supplier).toBe('hospital');
    // The recorded backend has no patient on the receipt yet (B3 adds it).
    expect(receipt.patientName).toBeNull();
  });

  it('reads the patient the backend adds, nested or flat (B3)', () => {
    const nested = toReceipt(
      receiptResponseSchema.parse({ ...recorded, patient: { full_name: 'Priya Nair', mrn: 'M1' } }),
    );
    expect([nested.patientName, nested.patientMrn]).toEqual(['Priya Nair', 'M1']);
    const flat = toReceipt(
      receiptResponseSchema.parse({ ...recorded, patient_name: 'Priya Nair', patient_mrn: 'M1' }),
    );
    expect([flat.patientName, flat.patientMrn]).toEqual(['Priya Nair', 'M1']);
  });

  it('joins only the address parts that exist', () => {
    expect(snapshotAddress({ address_line1: null, city: 'Kochi', pincode: '682040' })).toBe(
      'Kochi, 682040',
    );
    expect(snapshotAddress({})).toBeNull();
  });
});
