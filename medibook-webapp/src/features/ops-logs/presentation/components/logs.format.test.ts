import { describe, expect, it } from 'vitest';

import type { AuditLogEntry } from '@/features/ops-logs/domain/entities/logs.types';
import { filterParams } from '@/features/ops-logs/infrastructure/data-sources/remote/logs.api';
import {
  toAuditLogEntry,
  toChanges,
} from '@/features/ops-logs/infrastructure/data-sources/remote/logs.response';
import {
  actorLabel,
  isUuid,
  jsonText,
  moduleLabel,
  narrowingPrincipals,
} from '@/features/ops-logs/presentation/components/logs.format';

const ROW = {
  id: '01929b2e-0000-7000-8000-000000000001',
  occurred_at: '2026-10-07T04:12:00Z',
  request_id: 'req-1',
  principal: 'platform',
  actor_user_id: '01929b2e-0000-7000-8000-0000000000aa',
  hospital_id: null,
  ip: '10.0.0.1',
  method: 'POST',
  path: '/api/v1/platform/users/x/block',
  action: 'user.blocked',
  resource_type: 'user',
  resource_id: null,
  status_code: 200,
  before: { status: 'active' },
  after: { status: 'blocked' },
  diff: { status: ['active', 'blocked'], junk: 'not a pair' },
  meta: { reason: 'fraud' },
};

describe('toAuditLogEntry', () => {
  it('keeps before/after/meta and reads diff pairs', () => {
    const entry = toAuditLogEntry(ROW);
    expect(entry.before).toEqual({ status: 'active' });
    expect(entry.changes).toEqual([{ field: 'status', before: 'active', after: 'blocked' }]);
    expect(entry.meta).toEqual({ reason: 'fraud' });
  });

  it('parses an older backend without module, severity or names', () => {
    const entry = toAuditLogEntry(ROW);
    expect(entry.module).toBeNull();
    expect(entry.severity).toBeNull();
    expect(entry.actorName).toBeNull();
  });

  it('maps B6 module/severity and ignores an unknown severity', () => {
    expect(
      toAuditLogEntry({ ...ROW, module: 'platform_users', severity: 'WARNING' }),
    ).toMatchObject({ module: 'platform_users', severity: 'warning' });
    expect(toAuditLogEntry({ ...ROW, severity: 'loud' }).severity).toBeNull();
  });
});

describe('toChanges', () => {
  it('ignores anything that is not an object of pairs', () => {
    expect(toChanges(null)).toEqual([]);
    expect(toChanges(['a', 'b'])).toEqual([]);
    expect(toChanges({ n: [1, { a: 1 }] })).toEqual([
      { field: 'n', before: '1', after: '{"a":1}' },
    ]);
  });
});

describe('filterParams', () => {
  it('sends only the filters that are set, with the backend names', () => {
    expect(filterParams({})).toEqual({});
    expect(
      filterParams({
        dateFrom: '2026-10-01',
        actorUserId: 'u1',
        principals: ['hospital', 'platform'],
        action: 'user.blocked',
        hospitalId: 'h1',
        module: 'billing',
        severity: 'critical',
        q: 'req-1',
      }),
    ).toEqual({
      date_from: '2026-10-01',
      actor: 'u1',
      principal: 'hospital,platform',
      action: 'user.blocked',
      hospital_id: 'h1',
      module: 'billing',
      severity: 'critical',
      q: 'req-1',
    });
  });

  it('sends a single principal plainly (valid before B6 adds multi-value)', () => {
    expect(filterParams({ principals: ['patient'] })).toEqual({ principal: 'patient' });
  });
});

describe('display helpers', () => {
  const entry = (patch: Partial<AuditLogEntry>): AuditLogEntry => ({
    ...toAuditLogEntry(ROW),
    ...patch,
  });

  it('names the actor when the backend sends a name, else a short id', () => {
    expect(actorLabel(entry({ actorName: 'Kavya Iyer' }))).toBe('Ops staff · Kavya Iyer');
    expect(actorLabel(entry({}))).toBe('Ops staff · 01929b2e…');
    expect(actorLabel(entry({ actorUserId: null, principal: 'system' }))).toBe('System');
  });

  it('humanises unknown modules', () => {
    expect(moduleLabel('billing')).toBe('Billing');
    expect(moduleLabel('new_module')).toBe('new module');
    expect(moduleLabel(null)).toBe('—');
  });

  it('treats every principal as no principal filter', () => {
    expect(narrowingPrincipals(['patient', 'system'], ['patient', 'system'])).toEqual([]);
    expect(narrowingPrincipals(['patient'], ['patient', 'system'])).toEqual(['patient']);
  });

  it('shows no JSON block for empty values', () => {
    expect(jsonText(null)).toBeNull();
    expect(jsonText({})).toBeNull();
    expect(jsonText({ a: 1 })).toBe('{\n  "a": 1\n}');
  });

  it('accepts only full UUIDs as an actor id', () => {
    expect(isUuid(ROW.actor_user_id)).toBe(true);
    expect(isUuid('01929b2e')).toBe(false);
  });
});
