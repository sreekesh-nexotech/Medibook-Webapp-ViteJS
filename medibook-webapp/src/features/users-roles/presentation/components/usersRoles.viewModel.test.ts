import { describe, expect, it } from 'vitest';

import type {
  PermissionModule,
  StaffInvitation,
} from '@/features/users-roles/domain/entities/usersRoles.types';
import {
  extraPermissionModules,
  gridToPermissionCodes,
  invitationToRow,
  modulesHeld,
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
