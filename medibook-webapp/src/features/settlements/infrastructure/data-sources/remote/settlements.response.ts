import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  Payout,
  SettlementAdjustment,
  SettlementBreakdown,
  SettlementPeriod,
  SettlementPeriodDetail,
  SettlementStatement,
} from '@/features/settlements/domain/entities/settlements.entities';

/**
 * Settlement DTOs. `schema.yml` declares the lists as plain arrays, but every
 * view returns the standard page envelope (`core/pagination.py`), so that is
 * what is validated. The period detail is an untyped `dict` in the schema;
 * its shape comes from `HospitalSettlementPeriodDetailView`.
 */

export const settlementPeriodResponseSchema = z.object({
  id: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  status: z.enum(['open', 'closed', 'paid', 'on_hold']),
  gross_paise: z.number().int(),
  refunds_paise: z.number().int(),
  gateway_fees_paise: z.number().int(),
  commission_paise: z.number().int(),
  adjustments_paise: z.number().int(),
  tds_paise: z.number().int(),
  net_payable_paise: z.number().int(),
  closed_at: z.string().nullable(),
});

export const settlementPeriodPageResponseSchema = paginatedSchema(settlementPeriodResponseSchema);

export const payoutResponseSchema = z.object({
  id: z.string(),
  settlement_period_id: z.string(),
  amount_paise: z.number().int(),
  status: z.enum(['pending', 'released', 'failed', 'on_hold']),
  bank_account_last4: z.string().nullable(),
  utr_ref: z.string().nullable(),
  released_at: z.string().nullable(),
  failure_reason: z.string().nullable(),
  notes: z.string().nullable(),
});

const adjustmentResponseSchema = z.object({
  id: z.string(),
  amount_paise: z.number().int(),
  reason: z.string(),
  created_at: z.string(),
});

const breakdownResponseSchema = z.object({
  gross_paise: z.number().int(),
  refunds_paise: z.number().int(),
  gateway_fees_paise: z.number().int(),
  commission_paise: z.number().int(),
  commission_gst_paise: z.number().int(),
  convenience_fees_paise: z.number().int(),
  convenience_fee_gst_paise: z.number().int(),
  ledger_net_paise: z.number().int(),
  bookings_count: z.number().int(),
});

export const settlementPeriodDetailResponseSchema = settlementPeriodResponseSchema.extend({
  breakdown: breakdownResponseSchema,
  adjustments: z.array(adjustmentResponseSchema),
  payout: payoutResponseSchema.nullable(),
});

export const statementResponseSchema = z.object({
  id: z.string(),
  statement_no: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  issued_at: z.string(),
  pdf_file_id: z.string().nullable(),
});

export const statementPageResponseSchema = paginatedSchema(statementResponseSchema);

type SettlementPeriodResponse = z.infer<typeof settlementPeriodResponseSchema>;
type PayoutResponse = z.infer<typeof payoutResponseSchema>;
type SettlementPeriodDetailResponse = z.infer<typeof settlementPeriodDetailResponseSchema>;
type StatementResponse = z.infer<typeof statementResponseSchema>;

export function toSettlementPeriod(dto: SettlementPeriodResponse): SettlementPeriod {
  return {
    id: dto.id,
    periodStart: dto.period_start,
    periodEnd: dto.period_end,
    status: dto.status,
    grossPaise: dto.gross_paise,
    refundsPaise: dto.refunds_paise,
    gatewayFeesPaise: dto.gateway_fees_paise,
    commissionPaise: dto.commission_paise,
    adjustmentsPaise: dto.adjustments_paise,
    tdsPaise: dto.tds_paise,
    netPayablePaise: dto.net_payable_paise,
    closedAt: dto.closed_at,
  };
}

function toPayout(dto: PayoutResponse): Payout {
  return {
    id: dto.id,
    settlementPeriodId: dto.settlement_period_id,
    amountPaise: dto.amount_paise,
    status: dto.status,
    bankAccountLast4: dto.bank_account_last4,
    utrRef: dto.utr_ref,
    releasedAt: dto.released_at,
    failureReason: dto.failure_reason,
    notes: dto.notes,
  };
}

function toBreakdown(dto: SettlementPeriodDetailResponse['breakdown']): SettlementBreakdown {
  return {
    grossPaise: dto.gross_paise,
    refundsPaise: dto.refunds_paise,
    gatewayFeesPaise: dto.gateway_fees_paise,
    commissionPaise: dto.commission_paise,
    commissionGstPaise: dto.commission_gst_paise,
    convenienceFeesPaise: dto.convenience_fees_paise,
    convenienceFeeGstPaise: dto.convenience_fee_gst_paise,
    ledgerNetPaise: dto.ledger_net_paise,
    bookingsCount: dto.bookings_count,
  };
}

function toAdjustment(
  dto: SettlementPeriodDetailResponse['adjustments'][number],
): SettlementAdjustment {
  return {
    id: dto.id,
    amountPaise: dto.amount_paise,
    reason: dto.reason,
    createdAt: dto.created_at,
  };
}

export function toSettlementPeriodDetail(
  dto: SettlementPeriodDetailResponse,
): SettlementPeriodDetail {
  return {
    ...toSettlementPeriod(dto),
    breakdown: toBreakdown(dto.breakdown),
    adjustments: dto.adjustments.map(toAdjustment),
    payout: dto.payout ? toPayout(dto.payout) : null,
  };
}

export function toStatement(dto: StatementResponse): SettlementStatement {
  return {
    id: dto.id,
    statementNo: dto.statement_no,
    periodStart: dto.period_start,
    periodEnd: dto.period_end,
    issuedAt: dto.issued_at,
    pdfFileId: dto.pdf_file_id,
  };
}
