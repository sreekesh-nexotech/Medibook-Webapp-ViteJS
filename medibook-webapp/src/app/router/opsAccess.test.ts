import { describe, expect, it } from 'vitest';

import { opsPermissionChecks } from '@/shared/hooks/useOpsPermission';

import { canOpenOpsView, opsHomePath } from '@/app/router/opsAccess';

/** Backend `PLATFORM_ROLES.finance` (`core/seeds/v1.py`). */
const FINANCE = [
  ...['billing', 'settlements', 'plans', 'reports', 'analytics'].flatMap((m) => [
    `${m}.view`,
    `${m}.edit`,
  ]),
  'hospitals.view',
];

describe('ops access for a finance role', () => {
  const checks = opsPermissionChecks(FINANCE);

  it('opens only the finance screens', () => {
    for (const view of [
      'hospitals',
      'plans',
      'billing',
      'invoice-detail',
      'settlements',
      'analytics',
      'reports',
    ] as const) {
      expect(canOpenOpsView(view, checks), view).toBe(true);
    }
    for (const view of [
      'dashboard',
      'onboarding',
      'compliance',
      'logs',
      'users',
      'platform-users',
      'notifications',
      'settings',
    ] as const) {
      expect(canOpenOpsView(view, checks), view).toBe(false);
    }
  });

  it('can always open My Account', () => {
    expect(canOpenOpsView('account', checks)).toBe(true);
  });

  it('lands on the first screen it can open, not the dashboard', () => {
    expect(opsHomePath(checks)).toBe('/ops/hospitals');
  });

  it('allows the actions the backend allows and no others', () => {
    expect(checks.can('billing.edit')).toBe(true);
    expect(checks.can('hospitals.edit')).toBe(false);
    expect(checks.can('plans.del')).toBe(false);
    expect(checks.canAny('plans.add', 'plans.edit')).toBe(true);
    expect(checks.canAll('plans.add', 'plans.edit')).toBe(false);
  });
});

describe('ops access without a platform session', () => {
  it('allows nothing and lands on My Account', () => {
    const checks = opsPermissionChecks(null);
    expect(checks.can('dashboard.view')).toBe(false);
    expect(opsHomePath(checks)).toBe('/ops/account');
  });
});

/** Backend `PLATFORM_ROLES.support` (`core/seeds/v1.py`). */
const SUPPORT = [
  'support.view',
  'support.add',
  'support.edit',
  'support.del',
  'hospitals.view',
  'platform_users.view',
  'logs.view',
  'notifications.add',
  'notifications.edit',
];

describe('ops access to the screens added for UAT report §8', () => {
  it('keeps patient-app content behind settings.view', () => {
    expect(canOpenOpsView('content', opsPermissionChecks(['settings.view']))).toBe(true);
    expect(canOpenOpsView('content', opsPermissionChecks(SUPPORT))).toBe(false);
  });

  it('lets support moderate reviews (notifications.edit), not read-only roles', () => {
    expect(canOpenOpsView('reviews', opsPermissionChecks(SUPPORT))).toBe(true);
    expect(canOpenOpsView('reviews', opsPermissionChecks(['notifications.view']))).toBe(false);
  });
});
