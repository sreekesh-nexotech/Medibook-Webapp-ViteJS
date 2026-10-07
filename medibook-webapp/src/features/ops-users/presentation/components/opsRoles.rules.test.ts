import { describe, expect, it } from 'vitest';

import type {
  OpsStaffMember,
  OpsStaffRole,
} from '@/features/ops-users/domain/entities/opsUsers.types';
import {
  assignableRoles,
  canManageMember,
  isGridLocked,
  missingPermissions,
  roleCodeError,
  suggestRoleCode,
  toggleGrant,
} from '@/features/ops-users/presentation/components/opsRoles.rules';

const role = (code: string, permissions: string[]): OpsStaffRole => ({
  id: `r-${code}`,
  code,
  name: code,
  isSystem: code === 'owner' || code === 'support',
  permissions,
  version: 1,
});

const OWNER = role('owner', ['staff.view', 'staff.edit', 'settings.edit', 'logs.view']);
const SUPPORT = role('support', ['support.view', 'logs.view']);
const AUDITOR = role('auditor', ['logs.view']);
const ROLES = [OWNER, SUPPORT, AUDITOR];

const member = (userId: string, r: OpsStaffRole): OpsStaffMember => ({
  id: `s-${userId}`,
  userId,
  name: userId,
  email: `${userId}@medibook.example.com`,
  lastLoginAt: null,
  role: { id: r.id, code: r.code, name: r.name },
  status: 'active',
  lockedUntil: null,
  version: 1,
});

describe('role ceilings (B2, M-07)', () => {
  const hr = new Set(['staff.view', 'staff.edit', 'logs.view']);

  it('lists what the actor would be refused', () => {
    expect(missingPermissions(['settings.edit', 'logs.view'], hr)).toEqual(['settings.edit']);
  });

  it('offers only roles within the actor’s own grid', () => {
    expect(assignableRoles(ROLES, hr).map((r) => r.code)).toEqual(['auditor']);
  });

  it('never manages itself or a member above it', () => {
    expect(canManageMember(member('me', AUDITOR), ROLES, hr, 'me')).toBe(false);
    expect(canManageMember(member('boss', OWNER), ROLES, hr, 'me')).toBe(false);
    expect(canManageMember(member('sup', SUPPORT), ROLES, hr, 'me')).toBe(false);
    expect(canManageMember(member('aud', AUDITOR), ROLES, hr, 'me')).toBe(true);
  });

  it('locks the owner grid', () => {
    expect(isGridLocked(OWNER)).toBe(true);
    expect(isGridLocked(SUPPORT)).toBe(false);
  });
});

describe('role codes', () => {
  it('validates like the backend and refuses duplicates', () => {
    expect(roleCodeError('finance_lead', ROLES)).toBeNull();
    expect(roleCodeError('Finance', ROLES)).not.toBeNull();
    expect(roleCodeError('1x', ROLES)).not.toBeNull();
    expect(roleCodeError('auditor', ROLES)).toBe('A role with this code exists.');
  });

  it('suggests a code from a name', () => {
    expect(suggestRoleCode('Finance Lead (South)')).toBe('finance_lead_south');
    expect(suggestRoleCode('2nd line')).toBe('nd_line');
  });

  it('toggles grants', () => {
    expect(toggleGrant(['b', 'a'], 'c', true)).toEqual(['a', 'b', 'c']);
    expect(toggleGrant(['a', 'b'], 'a', false)).toEqual(['b']);
  });
});
