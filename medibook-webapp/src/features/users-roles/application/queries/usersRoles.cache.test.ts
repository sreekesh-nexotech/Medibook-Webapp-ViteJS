import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { applySavedRole } from '@/features/users-roles/application/queries/usersRoles.cache';
import { usersRolesKeys } from '@/features/users-roles/application/queries/usersRoles.keys';
import type { StaffRole } from '@/features/users-roles/domain/entities/usersRoles.types';

function role(code: StaffRole['code'], permissions: readonly string[], version: number): StaffRole {
  return {
    id: `id-${code}`,
    code,
    name: code,
    description: null,
    version,
    isSystem: true,
    editable: code !== 'admin',
    permissions,
  };
}

describe('applySavedRole', () => {
  it('replaces the saved role in the cached list and leaves the others alone', () => {
    const client = new QueryClient();
    const desk = role('dept_front_desk', ['appointments.view'], 1);
    const reception = role('receptionist', ['payments.view'], 4);
    client.setQueryData(usersRolesKeys.roles(), [desk, reception]);

    const saved = role('dept_front_desk', ['appointments.view', 'reports.view'], 2);
    applySavedRole(client, saved);

    expect(client.getQueryData(usersRolesKeys.roles())).toEqual([saved, reception]);
  });

  it('does nothing before the list was ever read', () => {
    const client = new QueryClient();
    applySavedRole(client, role('receptionist', [], 1));
    expect(client.getQueryData(usersRolesKeys.roles())).toBeUndefined();
  });
});
