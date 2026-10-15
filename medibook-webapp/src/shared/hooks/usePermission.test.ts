import { describe, expect, it } from 'vitest';

import {
  hospitalWriteBlock,
  permissionChecks,
  type PermissionKey,
} from '@/shared/hooks/usePermission';

/** The seeded receptionist role's codes (backend `core/seeds/v1.py`). */
const RECEPTIONIST = [
  'dashboard.view',
  'appointments.view',
  'appointments.add',
  'appointments.edit',
  'patients.view',
  'patients.add',
  'patients.edit',
  'token_management.view',
  'token_management.edit',
  'payments.view',
  'payments.add',
  'cash_desk.view',
  'cash_desk.add',
  'cash_desk.edit',
];

describe('permissionChecks for a hospital session', () => {
  const checks = permissionChecks(RECEPTIONIST);

  it('allows exactly the codes the role holds', () => {
    expect(checks.can('Appointments.add')).toBe(true);
    expect(checks.can('Payments.view')).toBe(true);
    expect(checks.can('Payments.del')).toBe(false);
    expect(checks.can('Doctors & Departments.view')).toBe(false);
  });

  it('maps display module names with spaces and ampersands to backend codes', () => {
    expect(checks.can('Token Management.edit')).toBe(true);
    expect(permissionChecks(['billing_settlements.edit']).can('Billing & Settlements.edit')).toBe(
      true,
    );
  });

  it('combines checks', () => {
    expect(checks.canAny('Payments.del', 'Appointments.add')).toBe(true);
    expect(checks.canAll('Appointments.view', 'Payments.del')).toBe(false);
    expect(checks.canAny()).toBe(true);
  });

  it('answers module visibility from the view flag', () => {
    expect(checks.canViewModule('Appointments')).toBe(true);
    expect(checks.canViewModule('Reports')).toBe(false);
    expect(checks.perms?.Payments).toEqual({ view: true, add: true, edit: false, del: false });
  });

  it('refuses a malformed key', () => {
    expect(checks.can('Nonsense.view' as PermissionKey)).toBe(false);
  });
});

describe('permissionChecks without a hospital session', () => {
  it('leaves access to the route guards', () => {
    const checks = permissionChecks(null);
    expect(checks.can('Users & Roles.del')).toBe(true);
    expect(checks.perms).toBeNull();
  });
});

describe('write blocks (UAT-38)', () => {
  it('turns every add/edit/del off for a read-only or suspended hospital, keeping views', () => {
    const checks = permissionChecks(RECEPTIONIST, 'read_only');
    expect(checks.writeBlock).toBe('read_only');
    expect(checks.can('Appointments.view')).toBe(true);
    expect(checks.can('Appointments.add')).toBe(false);
    expect(checks.can('Payments.add')).toBe(false);
    expect(checks.canViewModule('Appointments')).toBe(true);
  });

  it('derives the block from the hospital state', () => {
    expect(hospitalWriteBlock({ status: 'active', readOnly: false })).toBeNull();
    expect(hospitalWriteBlock({ status: 'active', readOnly: true })).toBe('read_only');
    expect(hospitalWriteBlock({ status: 'suspended', readOnly: false })).toBe('suspended');
    expect(hospitalWriteBlock({ status: 'closed', readOnly: true })).toBe('suspended');
  });

  it('never blocks the ops console (no hospital session)', () => {
    expect(permissionChecks(null, 'read_only').writeBlock).toBeNull();
  });
});
