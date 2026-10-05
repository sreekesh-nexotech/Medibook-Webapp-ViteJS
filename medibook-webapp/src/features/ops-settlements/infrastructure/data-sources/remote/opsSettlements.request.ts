import type {
  PayoutRelease,
  PayoutRunDraft,
} from '@/features/ops-settlements/domain/entities/opsSettlements.entities';

/** `PayoutRunCreateRequest`. */
export interface PayoutRunCreateRequest {
  readonly period_start: string;
  readonly period_end: string;
  readonly scheduled_for: string | null;
  readonly notes: string | null;
}

/** `PayoutRunReleaseRequest` — one transfer reference per payout. */
export interface PayoutRunReleaseRequest {
  readonly payouts: readonly { readonly id: string; readonly utr_ref: string }[];
}

/** `PayoutCommandRequest` for `/payouts/{id}/release`. */
export interface PayoutReleaseRequest {
  readonly utr_ref: string;
}

export function toPayoutRunCreateRequest(draft: PayoutRunDraft): PayoutRunCreateRequest {
  return {
    period_start: draft.periodStart,
    period_end: draft.periodEnd,
    scheduled_for: draft.scheduledFor,
    notes: draft.notes,
  };
}

export function toPayoutRunReleaseRequest(
  releases: readonly PayoutRelease[],
): PayoutRunReleaseRequest {
  return { payouts: releases.map((r) => ({ id: r.payoutId, utr_ref: r.utrRef })) };
}
