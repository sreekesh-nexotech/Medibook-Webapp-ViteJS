import { describe, expect, it } from 'vitest';

import type { DataRequest } from '@/features/ops-compliance/domain/entities/compliance.entities';
import {
  toDataRequestParams,
  toLoginFilterParams,
  toPhiAccessParams,
} from '@/features/ops-compliance/infrastructure/data-sources/remote/compliance.request';
import {
  dataRequestActions,
  dataRequestNote,
  isFullUuid,
  loginInstanceLabel,
  phiReadLabel,
  phiResultLabel,
} from '@/features/ops-compliance/presentation/components/compliance.labels';

const BASE: DataRequest = {
  id: 'd1',
  requestNo: 'DSR-2026-000001',
  subjectKind: 'patient',
  subjectUserId: 'u1',
  hospitalId: null,
  kind: 'export',
  status: 'requested',
  requestedByKind: 'platform_staff',
  requestedById: null,
  requestedAt: '2026-10-01T04:00:00Z',
  coolingOffEndsAt: null,
  dueAt: '2026-10-31T04:00:00Z',
  completedAt: null,
  exportFileId: null,
  notes: null,
  retentionCarveOut: null,
  subjectName: null,
  subjectContact: null,
  hospitalName: null,
  requestedByName: null,
  allowedActions: null,
};

describe('dataRequestActions (UAT-54)', () => {
  it('never offers Reject on a deletion, even an open one', () => {
    expect(dataRequestActions({ ...BASE, kind: 'deletion' }, true).canReject).toBe(false);
  });

  it('offers nothing on cooling-off rows — they complete on their own', () => {
    const a = dataRequestActions({ ...BASE, kind: 'deletion', status: 'cooling_off' }, true);
    expect(a).toEqual({ canPrepare: false, canRectify: false, canReject: false });
  });

  it('offers Prepare on open exports and Mark rectified on open rectifications', () => {
    expect(dataRequestActions(BASE, true)).toEqual({
      canPrepare: true,
      canRectify: false,
      canReject: true,
    });
    expect(dataRequestActions({ ...BASE, kind: 'rectification' }, true)).toEqual({
      canPrepare: false,
      canRectify: true,
      canReject: true,
    });
  });

  it('follows the actions the server allows when it lists them (B6)', () => {
    expect(dataRequestActions({ ...BASE, allowedActions: [] }, true)).toEqual({
      canPrepare: false,
      canRectify: false,
      canReject: false,
    });
    expect(dataRequestActions({ ...BASE, allowedActions: ['process'] }, true)).toEqual({
      canPrepare: true,
      canRectify: false,
      canReject: false,
    });
  });

  it('offers nothing on closed requests or without compliance.edit', () => {
    expect(dataRequestActions({ ...BASE, status: 'completed' }, true).canReject).toBe(false);
    expect(dataRequestActions(BASE, false)).toEqual({
      canPrepare: false,
      canRectify: false,
      canReject: false,
    });
  });
});

describe('dataRequestNote', () => {
  it('says a cooling-off deletion completes on its own', () => {
    expect(
      dataRequestNote({
        ...BASE,
        kind: 'deletion',
        status: 'cooling_off',
        coolingOffEndsAt: '2026-11-01T00:00:00Z',
      }),
    ).toMatch(/^Deletes automatically on/);
  });

  it('only promises the nightly run for exports', () => {
    expect(dataRequestNote(BASE)).toBe('The nightly run prepares it if not now');
    expect(dataRequestNote({ ...BASE, kind: 'rectification' })).toBe(
      'Correct the record, then mark it rectified',
    );
  });
});

describe('loginInstanceLabel (12·F16)', () => {
  const nameOf = (id: string) => (id === 'h1' ? 'Lakeshore' : null);

  it('labels by principal when no hospital is recorded', () => {
    expect(
      loginInstanceLabel({ principal: 'platform', hospitalId: null, hospitalName: null }, nameOf),
    ).toBe('Ops console');
    expect(
      loginInstanceLabel({ principal: 'patient', hospitalId: null, hospitalName: null }, nameOf),
    ).toBe('Patient app');
    expect(
      loginInstanceLabel({ principal: 'hospital', hospitalId: null, hospitalName: null }, nameOf),
    ).toBe('Hospital (not recorded)');
  });

  it('prefers the name on the row, then the registry', () => {
    expect(
      loginInstanceLabel(
        { principal: 'hospital', hospitalId: 'h1', hospitalName: 'From row' },
        nameOf,
      ),
    ).toBe('From row');
    expect(
      loginInstanceLabel({ principal: 'hospital', hospitalId: 'h1', hospitalName: null }, nameOf),
    ).toBe('Lakeshore');
  });
});

describe('request params', () => {
  it('sends register filters with the backend names', () => {
    expect(
      toDataRequestParams({
        page: 2,
        pageSize: 10,
        statuses: ['requested', 'verifying'],
        kind: 'rectification',
        subjectKind: 'patient',
      }),
    ).toEqual({
      page: 2,
      page_size: 10,
      sort: '-requested_at',
      status: 'requested,verifying',
      kind: 'rectification',
      subject_kind: 'patient',
    });
  });

  it('sends the B6 request number and dates only when used', () => {
    const base = { page: 1, pageSize: 10, statuses: [], kind: null, subjectKind: null };
    expect(toDataRequestParams({ ...base, requestNo: ' ', dateFrom: '' })).toEqual({
      page: 1,
      page_size: 10,
      sort: '-requested_at',
    });
    expect(
      toDataRequestParams({
        ...base,
        requestNo: 'dsr-2026-000004',
        dateFrom: '2026-10-01',
        dateTo: '2026-10-07',
      }),
    ).toMatchObject({
      request_no: 'DSR-2026-000004',
      date_from: '2026-10-01',
      date_to: '2026-10-07',
    });
  });

  it('joins several sign-in principals and sends one plainly', () => {
    const base = { dateFrom: '', dateTo: '', result: null, hospitalId: null };
    expect(toLoginFilterParams({ ...base, principals: ['hospital', 'platform'] })).toEqual({
      principal: 'hospital,platform',
    });
    expect(toLoginFilterParams({ ...base, principals: [] })).toEqual({});
  });
});

describe('patient record access (B6, H-07)', () => {
  it('names logged reads by their route', () => {
    const read = (endpoint: string, searchParam: string | null = null) =>
      phiReadLabel({ endpoint, method: 'GET', searchParam });
    expect(read('api/v1/hospital/patients/<uuid:patient_id>')).toBe('Opened a patient record');
    expect(read('api/v1/hospital/patients/<uuid:patient_id>/appointments')).toBe(
      'Viewed a patient’s appointments',
    );
    expect(read('api/v1/hospital/patients', 'q')).toBe('Searched patient records');
    expect(read('api/v1/hospital/patients')).toBe('Listed patient records');
    expect(read('api/v1/platform/users/<uuid:user_id>')).toBe('Opened a patient account');
    expect(read('api/v1/hospital/somewhere')).toBe('GET api/v1/hospital/somewhere');
  });

  it('counts returned records', () => {
    expect(phiResultLabel(0)).toBe('No records');
    expect(phiResultLabel(1)).toBe('1 record');
    expect(phiResultLabel(1200)).toBe('1,200 records');
  });

  it('takes only full UUIDs for id filters', () => {
    expect(isFullUuid('01929b2e-0000-7000-8000-000000000001')).toBe(true);
    expect(isFullUuid('01929b2e')).toBe(false);
  });

  it('sends only the filters in use', () => {
    expect(
      toPhiAccessParams({
        page: 1,
        pageSize: 15,
        sortDirection: 'desc',
        dateFrom: '2026-10-01',
        dateTo: '',
        principals: ['hospital', 'platform'],
        subjectKind: 'hospital_patient',
        hospitalId: null,
        actorUserId: null,
        subjectId: null,
        search: ' 9812345678 ',
      }),
    ).toEqual({
      date_from: '2026-10-01',
      principal: 'hospital,platform',
      subject_kind: 'hospital_patient',
      search: '9812345678',
      page: 1,
      page_size: 15,
      sort: '-occurred_at',
    });
  });
});
