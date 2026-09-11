import { create } from 'zustand';

import { useLogsStore } from '@/features/ops-logs/application/store/logs.store';

import { PLATFORM_USERS } from './platformUsers.fixtures';
import type { PlatformUser, PlatformUserStatus } from './platformUsers.types';

/**
 * Platform users (patient accounts) store — design `OpsDB.platformUsers` +
 * the Ops.jsx block/unblock and logged detail-view flows. Block/unblock
 * toasts come from the screen's `useOpsAct` run, as in the prototype.
 *
 * The list is **derived**: `statusOverrides` records what this console has
 * changed and `deriveUsers` re-applies those onto the seeded roster. That is
 * what makes `refresh()` genuine work rather than a toast (audit 3.1.1) — it
 * re-runs the same derivation the screen reads, exactly as a refetch would,
 * and re-stamps `refreshedAt`.
 */

/** Compliance-log module name for patient-account actions. */
const PLATFORM_USERS_LOG_MODULE = 'Platform Users';

/** Account-state changes made from the console, keyed by account id. */
type StatusOverrides = Readonly<Record<number, PlatformUserStatus>>;

/** The roster as the screens read it: seeded accounts + recorded overrides. */
function deriveUsers(overrides: StatusOverrides): readonly PlatformUser[] {
  return PLATFORM_USERS.map((u) => {
    const status = overrides[u.id];
    return status && status !== u.status ? { ...u, status } : u;
  });
}

interface PlatformUsersState {
  statusOverrides: StatusOverrides;
  users: readonly PlatformUser[];
  /** Epoch ms of the last derive, so the screen can show a real "updated" stamp. */
  refreshedAt: number;
}

interface PlatformUsersActions {
  /** Block an active account / unblock a blocked one (+ Critical audit line). */
  toggleBlock: (id: number) => void;
  /** Compliance log written every time a patient account detail is opened. */
  logView: (email: string) => void;
  /** Re-derive the roster from the seed + recorded overrides, and re-stamp. */
  refresh: () => void;
}

export const usePlatformUsersStore = create<PlatformUsersState & PlatformUsersActions>()(
  (set, get) => ({
    statusOverrides: {},
    users: deriveUsers({}),
    refreshedAt: Date.now(),

    toggleBlock: (id) => {
      const u = get().users.find((x) => x.id === id);
      if (!u) return;
      const was = u.status === 'Blocked';
      const next: PlatformUserStatus = was ? 'Active' : 'Blocked';
      set((s) => {
        const statusOverrides = { ...s.statusOverrides, [id]: next };
        return { statusOverrides, users: deriveUsers(statusOverrides) };
      });
      useLogsStore.getState().addLog({
        action: `Patient account ${was ? 'unblocked' : 'blocked'} — ${u.email}`,
        module: PLATFORM_USERS_LOG_MODULE,
        sev: 'Critical',
      });
    },

    logView: (email) =>
      useLogsStore.getState().addLog({
        action: `Patient account viewed — ${email}`,
        module: PLATFORM_USERS_LOG_MODULE,
        sev: 'Info',
      }),

    refresh: () => set((s) => ({ users: deriveUsers(s.statusOverrides), refreshedAt: Date.now() })),
  }),
);
