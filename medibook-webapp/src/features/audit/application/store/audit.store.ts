import { create } from 'zustand';

import { useAuthStore, type AuthRole } from '@/features/auth/application/store/auth.store';

import { localDateIso, localTimeHm } from './audit.clock';
import { SEED_AUDIT_ENTRIES } from './audit.fixtures';
import type { AuditDraft, AuditEntry } from './audit.types';

/**
 * Hospital audit-trail store — audit X-05 ("The hospital app has no log screen
 * at all"). The operations console appends to `ops-logs`; this is the
 * hospital's own equivalent, so a hospital admin can answer "who changed this
 * and when" without asking Medibook.
 *
 * Any feature action that changes a record calls `recordAudit()` (the
 * store-free helper below) right where it mutates, exactly like the ops
 * stores call `addLog`. The entry is stamped with the signed-in user, the
 * local clock and the demo client — never with `toISOString()`, which would
 * file today's 00:30 change under yesterday.
 */

/** Client string stamped on entries written from this browser session. */
const CURRENT_DEVICE = 'Chrome · This browser';

/** Demo LAN address stamped on entries written from this browser session. */
const CURRENT_IP = '192.168.1.14';

/**
 * The signed-in identity per auth role, for the trail's "actor (role)"
 * column. Mirrors the shell's `ROLE_USERS` demo identities; held here rather
 * than imported so an application-layer store never reaches up into
 * `app/layouts`.
 */
const ROLE_IDENTITY: Readonly<Record<AuthRole, { readonly name: string; readonly role: string }>> =
  {
    admin: { name: 'Dr. S. Nair', role: 'Administrator' },
    receptionist: { name: 'Riya Menon', role: 'Receptionist' },
    ops: { name: 'Medibook Operations', role: 'Platform Operations' },
  };

interface AuditState {
  entries: readonly AuditEntry[];
}

interface AuditActions {
  /** Prepend a trail entry; id, date, time, actor and device are stamped here. */
  record: (draft: AuditDraft) => void;
}

export type AuditStore = AuditState & AuditActions;

/** Monotonic id suffix so two entries in the same minute never collide. */
let auditSeq = SEED_AUDIT_ENTRIES.length;

export const useAuditStore = create<AuditStore>()((set) => ({
  entries: SEED_AUDIT_ENTRIES,
  record: (draft) =>
    set((s) => {
      const who = ROLE_IDENTITY[useAuthStore.getState().role];
      auditSeq += 1;
      const entry: AuditEntry = {
        id: `au-${String(auditSeq).padStart(3, '0')}`,
        date: localDateIso(),
        time: localTimeHm(),
        actor: draft.actor ?? who.name,
        actorRole: draft.actorRole ?? who.role,
        action: draft.action,
        summary: draft.summary,
        entity: draft.entity,
        entityId: draft.entityId,
        before: draft.before ?? null,
        after: draft.after ?? null,
        ip: draft.ip ?? CURRENT_IP,
        device: draft.device ?? CURRENT_DEVICE,
        sev: draft.sev ?? 'Info',
      };
      return { entries: [entry, ...s.entries] };
    }),
}));

/**
 * Append a trail entry from anywhere — a store action, a screen handler — with
 * no hook and no import cycle back into React:
 *
 * ```ts
 * recordAudit({ action: 'Update', entity: 'Settings', entityId: 'rules.duration',
 *               summary: 'Slot length changed', before: '20 mins', after: '15 mins',
 *               sev: 'Warning' });
 * ```
 */
export function recordAudit(draft: AuditDraft): void {
  useAuditStore.getState().record(draft);
}

/** Every trail entry, newest first (the store keeps insertion order). */
export function selectAuditEntries(s: AuditState): readonly AuditEntry[] {
  return s.entries;
}
