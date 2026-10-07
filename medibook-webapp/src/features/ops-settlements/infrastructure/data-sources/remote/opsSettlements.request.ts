import type {
  AdjustmentDraft,
  PayoutRelease,
  PayoutRunDraft,
  PeriodCloseRequest,
} from '@/features/ops-settlements/domain/entities/opsSettlements.entities';

const PAISE_PER_RUPEE = 100;

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

/** `PayoutCommandRequest` for `/payouts/{id}/hold` and `/fail`. */
export interface PayoutReasonRequest {
  readonly reason: string;
}

/** `PeriodCloseSerializer`: no `hospital_id` closes every hospital with activity. */
export interface PeriodCloseBody {
  readonly hospital_id?: string;
  readonly period_start: string;
  readonly period_end: string;
}

/** `AdjustmentCreateSerializer`: signed paise. */
export interface AdjustmentCreateRequest {
  readonly hospital_id: string;
  readonly settlement_period_id: string;
  readonly amount_paise: number;
  readonly reason: string;
}

/** `StatementIssueSerializer`. */
export interface StatementIssueRequest {
  readonly period: string;
}

export function toPeriodCloseBody(request: PeriodCloseRequest): PeriodCloseBody {
  return {
    ...(request.hospitalId ? { hospital_id: request.hospitalId } : {}),
    period_start: request.periodStart,
    period_end: request.periodEnd,
  };
}

export function toAdjustmentCreateRequest(draft: AdjustmentDraft): AdjustmentCreateRequest {
  return {
    hospital_id: draft.hospitalId,
    settlement_period_id: draft.settlementPeriodId,
    amount_paise: Math.round(draft.amountRupees * PAISE_PER_RUPEE),
    reason: draft.reason,
  };
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
