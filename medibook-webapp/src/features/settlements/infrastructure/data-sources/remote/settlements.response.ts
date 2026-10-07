import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  Payout,
  SettlementAdjustment,
  SettlementBreakdown,
  SettlementPeriod,
  SettlementPeriodDetail,
  SettlementStatement,
  StatementRef,
} from '@/features/settlements/domain/entities/settlements.entities';

/**
 * Settlement DTOs. `schema.yml` declares the lists as plain arrays, but every
 * view returns the standard page envelope (`core/pagination.py`), so that is
 * what is validated. The period detail is an untyped `dict` in the schema;
 * its shape comes from `HospitalSettlementPeriodDetailView`.
 *
 * Fields the backend's settlement fixes add (B4: the period's statement
 * links, the breakdown's own reconciliation, `carried_forward` adjustments)
 * are optional, so this screen keeps working against a server without them.
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
  period_start: z.string().nullable().optional(),
  period_end: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
});

export const payoutPageResponseSchema = paginatedSchema(payoutResponseSchema);

const adjustmentResponseSchema = z.object({
  id: z.string(),
  amount_paise: z.number().int(),
  reason: z.string(),
  created_at: z.string(),
  carried_forward: z.boolean().optional(),
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
  carried_adjustments_paise: z.number().int().optional(),
  late_entries: z.number().int().optional(),
  expected_net_paise: z.number().int().optional(),
  difference_paise: z.number().int().optional(),
  reconciled: z.boolean().optional(),
});

const statementRefResponseSchema = z.object({
  id: z.string(),
  statement_no: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  issued_at: z.string(),
});

export const settlementPeriodDetailResponseSchema = settlementPeriodResponseSchema.extend({
  breakdown: breakdownResponseSchema,
  adjustments: z.array(adjustmentResponseSchema),
  payout: payoutResponseSchema.nullable(),
  statement_id: z.string().nullable().optional(),
  statement_no: z.string().nullable().optional(),
  statements: z.array(statementRefResponseSchema).optional(),
});

export const statementResponseSchema = statementRefResponseSchema.extend({
  bookings_count: z.number().int(),
  gross_paise: z.number().int(),
  refunds_paise: z.number().int(),
  gateway_fees_paise: z.number().int(),
  commission_paise: z.number().int(),
  commission_gst_paise: z.number().int(),
  convenience_fees_paise: z.number().int(),
  convenience_fee_gst_paise: z.number().int(),
  net_payable_paise: z.number().int(),
  pdf_file_id: z.string().nullable(),
});

export const statementPageResponseSchema = paginatedSchema(statementResponseSchema);

type SettlementPeriodResponse = z.infer<typeof settlementPeriodResponseSchema>;
type PayoutResponse = z.infer<typeof payoutResponseSchema>;
type SettlementPeriodDetailResponse = z.infer<typeof settlementPeriodDetailResponseSchema>;
type StatementResponse = z.infer<typeof statementResponseSchema>;
type StatementRefResponse = z.infer<typeof statementRefResponseSchema>;

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

export function toPayout(dto: PayoutResponse): Payout {
  return {
    id: dto.id,
    settlementPeriodId: dto.settlement_period_id,
    periodStart: dto.period_start ?? null,
    periodEnd: dto.period_end ?? null,
    amountPaise: dto.amount_paise,
    status: dto.status,
    bankAccountLast4: dto.bank_account_last4,
    utrRef: dto.utr_ref,
    releasedAt: dto.released_at,
    failureReason: dto.failure_reason,
    notes: dto.notes,
    createdAt: dto.created_at ?? null,
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
    carriedAdjustmentsPaise: dto.carried_adjustments_paise ?? 0,
    lateEntries: dto.late_entries ?? 0,
    expectedNetPaise: dto.expected_net_paise ?? null,
    differencePaise: dto.difference_paise ?? null,
    reconciled: dto.reconciled ?? null,
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
    carriedForward: dto.carried_forward ?? false,
  };
}

function toStatementRef(dto: StatementRefResponse): StatementRef {
  return {
    id: dto.id,
    statementNo: dto.statement_no,
    periodStart: dto.period_start,
    periodEnd: dto.period_end,
    issuedAt: dto.issued_at,
  };
}

/**
 * The period's statements with the one the server names (`statement_id`, the
 * month containing the period's start) first; `null` when it sends none.
 */
function toStatementRefs(dto: SettlementPeriodDetailResponse): readonly StatementRef[] | null {
  if (dto.statements === undefined) return null;
  const refs = dto.statements.map(toStatementRef);
  const primary = refs.find((r) => r.id === dto.statement_id);
  return primary ? [primary, ...refs.filter((r) => r !== primary)] : refs;
}

export function toSettlementPeriodDetail(
  dto: SettlementPeriodDetailResponse,
): SettlementPeriodDetail {
  return {
    ...toSettlementPeriod(dto),
    breakdown: toBreakdown(dto.breakdown),
    adjustments: dto.adjustments.map(toAdjustment),
    payout: dto.payout ? toPayout(dto.payout) : null,
    statements: toStatementRefs(dto),
  };
}

export function toStatement(dto: StatementResponse): SettlementStatement {
  return {
    ...toStatementRef(dto),
    bookingsCount: dto.bookings_count,
    grossPaise: dto.gross_paise,
    refundsPaise: dto.refunds_paise,
    gatewayFeesPaise: dto.gateway_fees_paise,
    commissionPaise: dto.commission_paise,
    commissionGstPaise: dto.commission_gst_paise,
    convenienceFeesPaise: dto.convenience_fees_paise,
    convenienceFeeGstPaise: dto.convenience_fee_gst_paise,
    netPayablePaise: dto.net_payable_paise,
    pdfFileId: dto.pdf_file_id,
  };
}
