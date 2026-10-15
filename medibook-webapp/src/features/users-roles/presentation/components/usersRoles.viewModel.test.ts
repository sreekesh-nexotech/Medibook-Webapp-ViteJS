import { describe, expect, it } from 'vitest';

import type {
  PermissionModule,
  StaffInvitation,
} from '@/features/users-roles/domain/entities/usersRoles.types';
import { buildRoleAccessPreview } from '@/features/users-roles/presentation/components/access-preview';
import {
  extraModuleAccess,
  extraPermissionModules,
  gridToPermissionCodes,
  invitationToRow,
  isOwnRow,
  modulesHeld,
  nonGridCodes,
  previewExtraModules,
  toPermsGrid,
} from '@/features/users-roles/presentation/components/usersRoles.viewModel';

/** The receptionist invitation on the test backend: still `invited`, link due 17:21 on 6 Oct. */
const invitation: StaffInvitation = {
  id: 'inv-1',
  email: 'pending@example.com',
  firstName: 'Pending',
  lastName: null,
  phone: null,
  roleCode: 'receptionist',
  status: 'invited',
  invitedAt: '2026-08-06T04:30:02Z',
  lastSentAt: '2026-09-29T17:21:37Z',
  resendCount: 1,
  expiresAt: '2026-10-06T17:21:37Z',
};

const all = ['add', 'del', 'edit', 'view'];
const catalogue: readonly PermissionModule[] = [
  { module: 'appointments', label: 'Appointments', actions: all },
  { module: 'cash_desk', label: 'Cash Desk', actions: all },
  { module: 'display_devices', label: 'Display Devices', actions: all },
  { module: 'patient_approvals', label: 'Patient Approvals', actions: all },
];

describe('invitation rows', () => {
  it('stays pending until the link expires', () => {
    const row = invitationToRow(invitation, Date.parse('2026-10-06T17:00:00Z'));
    expect(row.status).toBe('Pending');
    expect(row.resendCount).toBe(1);
  });

  it('reads as expired once expires_at has passed, whatever the stored status', () => {
    expect(invitationToRow(invitation, Date.parse('2026-10-06T17:30:00Z')).status).toBe('Expired');
  });
});

describe('modules outside the ten-row grid', () => {
  it('are taken from the catalogue', () => {
    expect(extraPermissionModules(catalogue).map((m) => m.label)).toEqual([
      'Cash Desk',
      'Display Devices',
      'Patient Approvals',
    ]);
  });

  it('are saved as edited, alongside the grid', () => {
    // Receptionist on the test backend holds cash_desk add/edit/view; the editor revoked `add`.
    const current = ['appointments.view', 'cash_desk.add', 'cash_desk.edit', 'cash_desk.view'];
    const grid = toPermsGrid(current);
    expect(gridToPermissionCodes(grid, ['cash_desk.edit', 'cash_desk.view'])).toEqual([
      'appointments.view',
      'cash_desk.edit',
      'cash_desk.view',
    ]);
  });

  it('count towards a role’s module coverage', () => {
    expect(modulesHeld(['appointments.view', 'cash_desk.view', 'cash_desk.add'])).toBe(2);
  });
});

describe('role editor keeps the outside-grid grants (UAT-22)', () => {
  const receptionist = [
    'appointments.view',
    'cash_desk.add',
    'cash_desk.edit',
    'cash_desk.view',
    'patients.view',
  ];

  it('starts from the role’s own codes, whatever the catalogue holds', () => {
    expect(nonGridCodes(receptionist)).toEqual([
      'cash_desk.add',
      'cash_desk.edit',
      'cash_desk.view',
    ]);
  });

  it('saves them back even when the catalogue never loaded', () => {
    const saved = gridToPermissionCodes(toPermsGrid(receptionist), nonGridCodes(receptionist));
    expect(saved).toEqual([...receptionist].sort());
  });

  it('lists what the role holds on each outside-grid module', () => {
    expect(extraModuleAccess(catalogue, receptionist)).toEqual([
      { module: 'cash_desk', label: 'Cash Desk', actions: ['add', 'edit', 'view'] },
      { module: 'display_devices', label: 'Display Devices', actions: [] },
      { module: 'patient_approvals', label: 'Patient Approvals', actions: [] },
    ]);
    expect(
      previewExtraModules([
        { module: 'payments', label: 'Payments', actions: ['view'] },
        { module: 'cash_desk', label: 'Cash Desk', actions: ['view'] },
      ]).map((m) => m.module),
    ).toEqual(['cash_desk']);
  });

  it('counts only the grid’s modules without a catalogue (08 F9)', () => {
    expect(modulesHeld(receptionist)).toBe(3);
    expect(modulesHeld(receptionist, true)).toBe(2);
  });
});

describe('access preview is permission-only (UAT-23)', () => {
  it('lets an accountant reach Billing & Settlements and Reports', () => {
    const accountant = toPermsGrid([
      'dashboard.view',
      'appointments.view',
      'payments.view',
      'billing_settlements.view',
      'reports.view',
    ]);
    const preview = buildRoleAccessPreview(accountant);
    const visible = preview.visible.map((i) => i.id);
    expect(visible).toEqual(expect.arrayContaining(['settlements', 'reports', 'payments', 'help']));
    expect(preview.denied.find((i) => i.id === 'users')?.needs).toBe('Users & Roles.view');
    expect(preview.isLockedOut).toBe(false);
  });

  it('flags a role with no module at all', () => {
    expect(buildRoleAccessPreview(toPermsGrid([])).isLockedOut).toBe(true);
  });
});

describe('own row and expired invitations (UAT-24, USR-01)', () => {
  it('recognises the signed-in user’s own staff row', () => {
    const row = invitationToRow(invitation, Date.parse('2026-10-06T17:00:00Z'));
    expect(isOwnRow(row, 'u-1')).toBe(false);
    expect(isOwnRow({ ...row, kind: 'staff', userId: 'u-1' }, 'u-1')).toBe(true);
    expect(isOwnRow({ ...row, kind: 'staff', userId: 'u-1' }, null)).toBe(false);
  });

  it('reads the backend’s expired status before the clock', () => {
    const row = invitationToRow(
      { ...invitation, status: 'expired' },
      Date.parse('2026-10-01T00:00:00Z'),
    );
    expect(row.status).toBe('Expired');
  });
});
