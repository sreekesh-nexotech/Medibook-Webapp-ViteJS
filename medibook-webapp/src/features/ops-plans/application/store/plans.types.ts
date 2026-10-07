/**
 * Plan-limit vocabulary shared by the plan cards and the plan modal (audit
 * SA-02). Only the ceilings v2 keeps — users, doctors, storage (D-30); the
 * bookings, branches and message-credit dimensions were removed (11·F24,
 * CLAUDE.md §12).
 */
import type { CatalogLimitKey } from '@/features/ops-plans/domain/entities/plans.catalog';

/**
 * One plan ceiling. `null` means **unlimited**; a number is a real cap — so a
 * plan that allows `0` doctors is a different plan from one with no doctor
 * ceiling at all.
 */
export type PlanLimit = number | null;

export type PlanLimitKey = CatalogLimitKey;
