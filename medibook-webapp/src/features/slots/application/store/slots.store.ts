import { create } from 'zustand';

import { todayIso } from '@/features/doctors/domain/calendar';
import { slotKey, type SlotRef } from '@/features/slots/domain/slot';

/**
 * Slot availability store — the **only** slot state the app persists.
 *
 * Slots themselves are derived (see `domain/slot-grid.ts`); what an admin
 * decides on top of them is not derivable, so this store holds exactly that:
 * the set of slots that have been explicitly blocked. Opening a slot removes
 * its block and the slot goes back to whatever the doctor's pattern says, so
 * the two can never drift apart.
 *
 * Client state, one store per feature, mutated only through these actions
 * (coding standards §4).
 */

/** A couple of seeded blocks, so the grid shows a blocked slot on first load. */
const SEED_BLOCKED_MINUTES: readonly number[] = [13 * 60, 13 * 60 + 30];
const SEED_BLOCKED_DOCTORS: readonly string[] = ['dr-anya-sharma', 'dr-leela-pillai'];

/**
 * Today's lunch-hour blocks for two doctors. Keys that do not match a
 * generated slot (because the hospital's slot length changed) are simply never
 * read — a stale key cannot block anything that does not exist.
 */
function seedBlocked(): Record<string, true> {
  const date = todayIso();
  const out: Record<string, true> = {};
  for (const doctorId of SEED_BLOCKED_DOCTORS) {
    for (const startMinutes of SEED_BLOCKED_MINUTES) {
      out[slotKey({ doctorId, date, startMinutes })] = true;
    }
  }
  return out;
}

interface SlotsState {
  /** `slotKey()` → blocked. Absent means "follow the doctor's pattern". */
  blocked: Readonly<Record<string, true>>;
}

interface SlotsActions {
  /** Block one slot. */
  blockSlot: (ref: SlotRef) => void;
  /** Open one slot (drop its block). */
  openSlot: (ref: SlotRef) => void;
  /** Block many slots in one write — the bulk update's commit. */
  blockSlots: (refs: readonly SlotRef[]) => void;
  /** Open many slots in one write. */
  openSlots: (refs: readonly SlotRef[]) => void;
}

export const useSlotsStore = create<SlotsState & SlotsActions>()((set) => ({
  blocked: seedBlocked(),

  blockSlot: (ref) => set((s) => ({ blocked: { ...s.blocked, [slotKey(ref)]: true } })),

  openSlot: (ref) =>
    set((s) => {
      const next = { ...s.blocked };
      delete next[slotKey(ref)];
      return { blocked: next };
    }),

  blockSlots: (refs) =>
    set((s) => {
      const next = { ...s.blocked };
      for (const ref of refs) next[slotKey(ref)] = true;
      return { blocked: next };
    }),

  openSlots: (refs) =>
    set((s) => {
      const next = { ...s.blocked };
      for (const ref of refs) delete next[slotKey(ref)];
      return { blocked: next };
    }),
}));
