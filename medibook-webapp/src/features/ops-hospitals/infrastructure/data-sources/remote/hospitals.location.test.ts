import { describe, expect, it } from 'vitest';

import {
  toHospitalCreateRequest,
  toHospitalPatchRequest,
} from '@/features/ops-hospitals/infrastructure/data-sources/remote/hospitals.request';
import {
  hospitalResponseSchema,
  toPlatformHospital,
} from '@/features/ops-hospitals/infrastructure/data-sources/remote/hospitals.response';
import type { HospitalCreateInput } from '@/features/ops-hospitals/domain/entities/hospitals.entity';

const ROW = {
  id: 'h-1',
  slug: 'lakeshore',
  name: 'Lakeshore',
  legal_name: null,
  gstin: null,
  registration_no: null,
  email: 'a@b.in',
  phone_e164: '+914842701000',
  website: null,
  address_line1: 'NH 66',
  address_line2: null,
  address_line3: null,
  city: 'Kochi',
  state: 'Kerala',
  pincode: '682304',
  status: 'active',
  app_visibility: 'visible',
  online_booking_enabled: true,
  commission_bp: 450,
  convenience_fee_kind: 'flat',
  convenience_fee_value: 2000,
  go_live_at: null,
  created_at: '2026-10-01T00:00:00Z',
  version: 3,
};

const CREATE: HospitalCreateInput = {
  slug: 'new',
  name: 'New',
  email: 'n@h.in',
  phoneE164: '+914842701000',
  addressLine1: 'Road',
  city: 'Kochi',
  state: 'Kerala',
  pincode: '682001',
  commissionBp: 450,
  convenienceFeeKind: 'flat',
  convenienceFeeValue: 2000,
  numbering: {
    mrn: { format: '{PREFIX}{SEQ:6}', prefix: 'NH' },
    booking: { format: '{PREFIX}{SEQ:6}', prefix: 'NH' },
    receipt: { format: '{PREFIX}{SEQ:6}', prefix: 'NH' },
  },
  planId: 'p-1',
  billingPeriod: 'monthly',
  firstAdmin: { email: 'x@h.in', firstName: 'X', lastName: null, phoneE164: null },
};

describe('Ops hospital map location (point 3)', () => {
  it('reads the location as numbers whatever form the server sends', () => {
    const read = (extra: object) =>
      toPlatformHospital(hospitalResponseSchema.parse({ ...ROW, ...extra }));
    expect(read({ lat: '9.926492', lng: '76.313371' })).toMatchObject({
      lat: 9.926492,
      lng: 76.313371,
    });
    expect(read({ lat: 9.93, lng: 76.26 })).toMatchObject({ lat: 9.93, lng: 76.26 });
    expect(read({ lat: null, lng: null })).toMatchObject({ lat: null, lng: null });
    expect(read({})).toMatchObject({ lat: null, lng: null }); // an older backend
  });

  it('sends the location only as a pair', () => {
    expect(toHospitalPatchRequest({ lat: 9.93, lng: 76.26 })).toEqual({ lat: 9.93, lng: 76.26 });
    expect(toHospitalPatchRequest({ lat: null, lng: null })).toEqual({ lat: null, lng: null });
    expect(toHospitalPatchRequest({ lat: 9.93 })).toEqual({});
  });

  it('onboards with a location when one was given, and without one otherwise', () => {
    expect(toHospitalCreateRequest({ ...CREATE, lat: 9.93, lng: 76.26 })).toMatchObject({
      lat: 9.93,
      lng: 76.26,
    });
    const without = toHospitalCreateRequest(CREATE);
    expect('lat' in without || 'lng' in without).toBe(false);
  });
});
