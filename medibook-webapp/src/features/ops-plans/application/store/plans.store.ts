import { create } from 'zustand';

import { APOLLO_HID } from '@/core/config/demo';

import { useInboxStore } from '@/features/ops-dashboard/application/store/inbox.store';
import { useHospitalsStore } from '@/features/ops-hospitals/application/store/hospitals.store';
import { useLogsStore } from '@/features/ops-logs/application/store/logs.store';
import { useSettlementsStore } from '@/features/settlements/application/store/settlements.store';

import { OPS_PLANS, OPS_PLAN_CHANGES } from './plans.fixtures';
import { bookingQuotaMirror } from './plans.limits';
import type { Plan, PlanChange, PlanLimits } from './plans.types';

/**
 * Subscription-plan catalog + plan-change queue (design `OpsDB.plans` /
 * `OpsDB.planChanges` and the Ops.jsx `PlanModal` / `applyChange` /
 * delete-plan mutations). Toasts for these flows come from the screens'
 * `useOpsAct` runs, as in the prototype; the delete guard ("hospitals are
 * still on this plan") also stays in the screen.
 */

/** Compliance-log module name for every plan mutation. */
const PLANS_LOG_MODULE = 'Subscription Plans';

/**
 * Save payload — a missing id means "create". Money fields and ceilings arrive
 * parsed; `quota` is not accepted because it is derived from `limits.bookings`
 * (one source of truth for what a plan allows — audit SA-02).
 */
export interface PlanSaveInput {
  readonly id?: number;
  readonly name: string;
  readonly price: number;
  /** `null` = monthly billing only. */
  readonly yearlyPrice: number | null;
  readonly limits: PlanLimits;
  readonly support: string;
  readonly extra: string;
  readonly popular: boolean;
  readonly custom: boolean;
}

/** New plan-change payload — the id is minted (max+1). */
export type PlanChangeDraft = Omit<PlanChange, 'id'>;

interface PlansState {
  plans: readonly Plan[];
  planChanges: readonly PlanChange[];
}

interface PlansActions {
  /**
   * Create or edit a plan. "Most Popular" is exclusive (setting it clears
   * every other plan's flag); a rename cascades to hospitals on the old name.
   */
  savePlan: (input: PlanSaveInput) => void;
  deletePlan: (id: number) => void;
  /**
   * Approve/decline a hospital's plan change: updates the hospital's plan on
   * approval, clears Apollo's own pending request banner, closes matching
   * open inbox requests and writes the audit line.
   */
  applyPlanChange: (c: PlanChange, ok: boolean) => void;
  /** Prepend a plan-change request (hospital-side request flow). */
  addPlanChange: (c: PlanChangeDraft) => void;
}

export const usePlansStore = create<PlansState & PlansActions>()((set, get) => ({
  plans: OPS_PLANS,
  planChanges: OPS_PLAN_CHANGES,

  savePlan: (input) => {
    const isNew = input.id == null;
    const name = input.name.trim();
    const old = isNew ? null : (get().plans.find((p) => p.id === input.id) ?? null);
    set((s) => {
      const cleared = input.popular ? s.plans.map((p) => ({ ...p, popular: false })) : s.plans;
      const record: Omit<Plan, 'id'> = {
        name,
        price: input.price,
        yearlyPrice: input.yearlyPrice,
        limits: input.limits,
        quota: bookingQuotaMirror(input.limits),
        support: input.support,
        extra: input.extra.trim(),
        popular: input.popular,
        custom: input.custom,
      };
      if (isNew) {
        const id = Math.max(...s.plans.map((p) => p.id)) + 1;
        return { plans: [...cleared, { id, ...record }] };
      }
      return {
        plans: cleared.map((p) => (p.id === input.id ? { ...p, ...record } : p)),
      };
    });
    if (old && old.name !== name) {
      useHospitalsStore.getState().cascadePlanRename(old.name, name);
    }
    useLogsStore.getState().addLog({
      action: `Plan ${isNew ? 'created' : 'updated'} — ${name}`,
      module: PLANS_LOG_MODULE,
      sev: 'Info',
    });
  },

  deletePlan: (id) => {
    const plan = get().plans.find((p) => p.id === id);
    if (!plan) return;
    set((s) => ({ plans: s.plans.filter((x) => x.id !== id) }));
    useLogsStore
      .getState()
      .addLog({ action: `Plan deleted — ${plan.name}`, module: PLANS_LOG_MODULE, sev: 'Critical' });
  },

  applyPlanChange: (c, ok) => {
    set((s) => ({
      planChanges: s.planChanges.map((x) =>
        x.id === c.id ? { ...x, status: ok ? 'Completed' : 'Cancelled' } : x,
      ),
    }));
    const target = c.change.split(' → ')[1];
    if (ok) {
      const hospitals = useHospitalsStore.getState();
      const hh = hospitals.hospitals.find((h) => h.id === c.hid);
      if (hh && get().plans.some((p) => p.name === target)) hospitals.setPlan(c.hid, target);
    }
    if (c.hid === APOLLO_HID) useSettlementsStore.getState().clearPlanChangeReq();
    useInboxStore.getState().closeRequests((q) => q.type === 'Plan' && q.hid === c.hid);
    useLogsStore.getState().addLog({
      hid: c.hid,
      action: `Plan change ${ok ? 'applied' : 'declined'} — ${c.hospital}: ${c.change}`,
      module: PLANS_LOG_MODULE,
      sev: 'Info',
    });
  },

  addPlanChange: (c) =>
    set((s) => {
      const id = Math.max(0, ...s.planChanges.map((x) => x.id)) + 1;
      return { planChanges: [{ ...c, id }, ...s.planChanges] };
    }),
}));
