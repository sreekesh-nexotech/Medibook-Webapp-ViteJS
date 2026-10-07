import { describe, expect, it } from 'vitest';

import {
  hospitalViewFromPath,
  isOpsReturnPath,
  loginReturningTo,
  opsLogsPath,
  opsPath,
  opsViewFromPath,
  returnPathAfterLogin,
} from '@/app/router/paths';

const FILE_ID = '01a0ee28-a797-79a0-a88d-b9f19c5bcbb9';
const HOSPITAL_LINK = `/reports/downloads/${FILE_ID}`;
const OPS_LINK = `/ops/reports/downloads/${FILE_ID}`;

describe('returnPathAfterLogin', () => {
  it('returns to an emailed report link on the console just signed in to', () => {
    expect(returnPathAfterLogin(HOSPITAL_LINK, 'hospital')).toBe(HOSPITAL_LINK);
    expect(returnPathAfterLogin(OPS_LINK, 'platform')).toBe(OPS_LINK);
  });

  it('never crosses into the other console', () => {
    expect(returnPathAfterLogin(HOSPITAL_LINK, 'platform')).toBeNull();
    expect(returnPathAfterLogin(OPS_LINK, 'hospital')).toBeNull();
  });

  it('refuses anything that is not exactly a report link', () => {
    const refused = [
      null,
      '/admin/dashboard',
      `https://evil.example${HOSPITAL_LINK}`,
      `//evil.example${HOSPITAL_LINK}`,
      `${HOSPITAL_LINK}?then=https://evil.example`,
      '/reports/downloads/not-a-uuid',
      `/reports/downloads/${FILE_ID}/../../admin`,
    ];
    for (const next of refused) {
      expect(returnPathAfterLogin(next, 'hospital'), String(next)).toBeNull();
    }
  });
});

describe('loginReturningTo', () => {
  it('carries the link in the next parameter', () => {
    expect(loginReturningTo(HOSPITAL_LINK)).toBe(
      `/auth/login?next=${encodeURIComponent(HOSPITAL_LINK)}`,
    );
  });
});

describe('isOpsReturnPath', () => {
  it('recognises only ops report links', () => {
    expect(isOpsReturnPath(OPS_LINK)).toBe(true);
    expect(isOpsReturnPath(HOSPITAL_LINK)).toBe(false);
    expect(isOpsReturnPath('/ops/dashboard')).toBe(false);
    expect(isOpsReturnPath(null)).toBe(false);
  });
});

describe('view ids from paths', () => {
  it('resolves hospital views, including detail and create pages', () => {
    expect(hospitalViewFromPath('/admin/payments')).toBe('payments');
    expect(hospitalViewFromPath('/receptionist/appointments/new')).toBe('create');
    expect(hospitalViewFromPath('/admin/patients/LKSM000043')).toBe('patient-detail');
    expect(hospitalViewFromPath('/admin/unknown')).toBe('dashboard');
  });

  it('resolves ops views, including detail pages', () => {
    expect(opsViewFromPath('/ops/hospitals')).toBe('hospitals');
    expect(opsViewFromPath(`/ops/hospitals/${FILE_ID}`)).toBe('hospital-detail');
    expect(opsViewFromPath('/ops/billing/invoices/inv-1')).toBe('invoice-detail');
    expect(opsViewFromPath('/ops/nowhere')).toBe('dashboard');
  });
});

describe('ops screens added for UAT report §8', () => {
  it('maps each new view to its own URL and back', () => {
    for (const view of ['content', 'reviews'] as const) {
      expect(opsViewFromPath(opsPath(view))).toBe(view);
    }
  });

  it('opens Compliance Logs filtered to one hospital', () => {
    expect(opsLogsPath()).toBe('/ops/logs');
    expect(opsLogsPath(FILE_ID)).toBe(`/ops/logs?hospital_id=${FILE_ID}`);
  });
});
