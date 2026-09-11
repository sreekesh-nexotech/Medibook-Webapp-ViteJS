import { create } from 'zustand';

import { useLogsStore } from '@/features/ops-logs/application/store/logs.store';

import { OPS_USERS } from './opsUsers.fixtures';
import type { OpsRole, OpsUser } from './opsUsers.types';

/**
 * Internal Medibook users store (design `OpsDB.users` + the Ops.jsx
 * AddOpsUserModal / delete-user mutations). Toasts for these flows come
 * from the screens' `useOpsAct` runs, as in the prototype.
 *
 * Every mutation writes its compliance-log line, so the audit trail on
 * Compliance Logs and the change log on Compliance both reflect who changed
 * an internal account and when.
 */

/** Compliance-log module name for internal-user actions. */
const OPS_USERS_LOG_MODULE = 'Users & Roles';

/** Add User modal payload — everything else starts in the Pending state. */
export interface AddOpsUserForm {
  readonly name: string;
  readonly email: string;
  readonly role: OpsRole;
}

/** Edit User payload — the three fields the editor exposes. */
export type EditOpsUserForm = AddOpsUserForm;

interface OpsUsersState {
  users: readonly OpsUser[];
}

interface OpsUsersActions {
  /** Prepend an invited user (2FA Pending, status Pending, no avatar). */
  addUser: (f: AddOpsUserForm) => void;
  /** Apply an edit to an existing user (+ a Critical line on a role change). */
  updateUser: (id: number, f: EditOpsUserForm) => void;
  deleteUser: (id: number) => void;
}

export const useOpsUsersStore = create<OpsUsersState & OpsUsersActions>()((set, get) => ({
  users: OPS_USERS,

  addUser: (f) => {
    set((s) => {
      const id = Math.max(...s.users.map((u) => u.id)) + 1;
      const record: OpsUser = {
        id,
        name: f.name,
        email: f.email,
        role: f.role,
        twofa: 'Pending',
        lastActive: '—',
        status: 'Pending',
        av: null,
      };
      return { users: [record, ...s.users] };
    });
    useLogsStore.getState().addLog({
      action: `Platform user invited — ${f.email} as ${f.role}`,
      module: OPS_USERS_LOG_MODULE,
      sev: 'Info',
    });
  },

  updateUser: (id, f) => {
    const before = get().users.find((u) => u.id === id);
    if (!before) return;
    set((s) => ({
      users: s.users.map((u) =>
        u.id === id ? { ...u, name: f.name, email: f.email, role: f.role } : u,
      ),
    }));
    const roleChanged = before.role !== f.role;
    useLogsStore.getState().addLog({
      action: roleChanged
        ? `Platform user role changed — ${f.email} · ${before.role} → ${f.role}`
        : `Platform user updated — ${f.email}`,
      module: OPS_USERS_LOG_MODULE,
      sev: roleChanged ? 'Critical' : 'Info',
    });
  },

  deleteUser: (id) => {
    const u = get().users.find((x) => x.id === id);
    if (!u) return;
    set((s) => ({ users: s.users.filter((x) => x.id !== id) }));
    useLogsStore.getState().addLog({
      action: `Platform user deleted — ${u.email}`,
      module: OPS_USERS_LOG_MODULE,
      sev: 'Critical',
    });
  },
}));
