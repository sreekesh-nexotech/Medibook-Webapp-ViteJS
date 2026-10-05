import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  Payout,
  PayoutRun,
  PayoutRunDetail,
  SettlementPeriod,
} from '@/features/ops-settlements/domain/entities/opsSettlements.entities';

/**
 * Response DTOs for `/platform/settlements/*`. The list endpoints are typed as
 * arrays in `schema.yml` but return the paginated envelope
 * (`core/pagination.py`); run detail / approve / release return
 * `{...PayoutRun, payouts: Payout[]}` (`views/platform_payout_run_detail.py`
 * `run_payload`), which the schema leaves untyped.
 */

const PAISE_PER_RUPEE = 100;

function toRupees(paise: number): number {
  return paise / PAISE_PER_RUPEE;
}

export const periodResponseSchema = z.object({
  id: z.string(),
  hospital_id: z.string(),
  hospital_name: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  status: z.enum(['open', 'closed', 'paid', 'on_hold']),
  gross_paise: z.number(),
  refunds_paise: z.number(),
  gateway_fees_paise: z.number(),
  commission_paise: z.number(),
  adjustments_paise: z.number(),
  tds_paise: z.number(),
  net_payable_paise: z.number(),
});

export const periodPageResponseSchema = paginatedSchema(periodResponseSchema);

export type PeriodResponse = z.infer<typeof periodResponseSchema>;

export const payoutRunResponseSchema = z.object({
  id: z.string(),
  run_no: z.string(),
  status: z.enum(['draft', 'approved', 'processing', 'released', 'partially_failed', 'failed']),
  period_start: z.string(),
  period_end: z.string(),
  scheduled_for: z.string().nullable(),
  approved_at: z.string().nullable(),
  released_at: z.string().nullable(),
  total_paise: z.number(),
  hospital_count: z.number().int(),
  notes: z.string().nullable(),
});

export const payoutRunPageResponseSchema = paginatedSchema(payoutRunResponseSchema);

export type PayoutRunResponse = z.infer<typeof payoutRunResponseSchema>;

export const payoutResponseSchema = z.object({
  id: z.string(),
  payout_run_id: z.string(),
  settlement_period_id: z.string(),
  hospital_id: z.string(),
  bank_account_id: z.string().nullable(),
  bank_account_last4: z.string().nullable(),
  amount_paise: z.number(),
  status: z.enum(['pending', 'released', 'failed', 'on_hold']),
  utr_ref: z.string().nullable(),
  released_at: z.string().nullable(),
  failure_reason: z.string().nullable(),
  notes: z.string().nullable(),
});

export type PayoutResponse = z.infer<typeof payoutResponseSchema>;

export const payoutRunDetailResponseSchema = payoutRunResponseSchema.extend({
  payouts: z.array(payoutResponseSchema),
});

export type PayoutRunDetailResponse = z.infer<typeof payoutRunDetailResponseSchema>;

export function toSettlementPeriod(dto: PeriodResponse): SettlementPeriod {
  return {
    id: dto.id,
    hospitalId: dto.hospital_id,
    hospitalName: dto.hospital_name,
    periodStart: dto.period_start,
    periodEnd: dto.period_end,
    status: dto.status,
    grossRupees: toRupees(dto.gross_paise),
    refundsRupees: toRupees(dto.refunds_paise),
    gatewayFeesRupees: toRupees(dto.gateway_fees_paise),
    commissionRupees: toRupees(dto.commission_paise),
    adjustmentsRupees: toRupees(dto.adjustments_paise),
    tdsRupees: toRupees(dto.tds_paise),
    netPayableRupees: toRupees(dto.net_payable_paise),
  };
}

export function toPayoutRun(dto: PayoutRunResponse): PayoutRun {
  return {
    id: dto.id,
    runNo: dto.run_no,
    status: dto.status,
    periodStart: dto.period_start,
    periodEnd: dto.period_end,
    scheduledFor: dto.scheduled_for,
    approvedAt: dto.approved_at,
    releasedAt: dto.released_at,
    totalRupees: toRupees(dto.total_paise),
    hospitalCount: dto.hospital_count,
    notes: dto.notes,
  };
}

export function toPayout(dto: PayoutResponse): Payout {
  return {
    id: dto.id,
    payoutRunId: dto.payout_run_id,
    settlementPeriodId: dto.settlement_period_id,
    hospitalId: dto.hospital_id,
    bankAccountLast4: dto.bank_account_last4,
    hasBankAccount: dto.bank_account_id !== null,
    amountRupees: toRupees(dto.amount_paise),
    status: dto.status,
    utrRef: dto.utr_ref,
    releasedAt: dto.released_at,
    failureReason: dto.failure_reason,
    notes: dto.notes,
  };
}

export function toPayoutRunDetail(dto: PayoutRunDetailResponse): PayoutRunDetail {
  return { run: toPayoutRun(dto), payouts: dto.payouts.map(toPayout) };
}
