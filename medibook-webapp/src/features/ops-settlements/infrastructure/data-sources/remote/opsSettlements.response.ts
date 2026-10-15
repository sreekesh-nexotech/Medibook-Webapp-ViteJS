import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  Payout,
  PayoutRun,
  PayoutRunCreated,
  PayoutRunDetail,
  PeriodBreakdown,
  PeriodCloseOutcome,
  PlatformStatement,
  SettlementAdjustment,
  SettlementPeriod,
  SettlementPeriodDetail,
  StatementIssueResult,
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

function toRupeesOrNull(paise: number | null | undefined): number | null {
  return paise === null || paise === undefined ? null : toRupees(paise);
}

const runStatusSchema = z.enum([
  'draft',
  'approved',
  'processing',
  'released',
  'partially_failed',
  'failed',
]);

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
  closed_at: z.string().nullable().optional(),
});

export const periodPageResponseSchema = paginatedSchema(periodResponseSchema);

export type PeriodResponse = z.infer<typeof periodResponseSchema>;

export const payoutRunResponseSchema = z.object({
  id: z.string(),
  run_no: z.string(),
  status: runStatusSchema,
  period_start: z.string(),
  period_end: z.string(),
  scheduled_for: z.string().nullable(),
  approved_at: z.string().nullable(),
  released_at: z.string().nullable(),
  total_paise: z.number(),
  hospital_count: z.number().int(),
  notes: z.string().nullable(),
  initiated_by_id: z.string().nullable().optional(),
});

/** `skipped` on a new run (M-45): periods left out for want of a verified primary account. */
const runSkipSchema = z.object({
  hospital_id: z.string(),
  settlement_period_id: z.string().nullable().optional(),
  net_payable_paise: z.number().nullable().optional(),
  reason: z.string(),
});

export const payoutRunCreatedResponseSchema = payoutRunResponseSchema.extend({
  skipped: z.array(runSkipSchema).optional(),
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
  run_no: z.string().nullable().optional(),
  period_start: z.string().nullable().optional(),
  period_end: z.string().nullable().optional(),
  // Flat payout list extras (BE-27).
  run_status: runStatusSchema.optional(),
  hospital_name: z.string().optional(),
  bank_account_verified: z.boolean().optional(),
});

export const payoutPageResponseSchema = paginatedSchema(payoutResponseSchema);

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

/** The ledger breakdown (`ledger_totals.as_breakdown` + the BE-27 reconciliation). */
const breakdownSchema = z.object({
  gross_paise: z.number(),
  refunds_paise: z.number(),
  gateway_fees_paise: z.number(),
  commission_paise: z.number(),
  commission_gst_paise: z.number().optional(),
  convenience_fees_paise: z.number().optional(),
  convenience_fee_gst_paise: z.number().optional(),
  carried_adjustments_paise: z.number().optional(),
  ledger_net_paise: z.number().optional(),
  bookings_count: z.number().int().optional(),
  entries: z.number().int().optional(),
  late_entries: z.number().int().optional(),
  expected_net_paise: z.number().nullable().optional(),
  difference_paise: z.number().nullable().optional(),
  reconciled: z.boolean().nullable().optional(),
});

function toBreakdown(dto: z.infer<typeof breakdownSchema>): PeriodBreakdown {
  return {
    grossRupees: toRupees(dto.gross_paise),
    refundsRupees: toRupees(dto.refunds_paise),
    gatewayFeesRupees: toRupees(dto.gateway_fees_paise),
    commissionRupees: toRupees(dto.commission_paise),
    commissionGstRupees: toRupees(dto.commission_gst_paise ?? 0),
    convenienceFeesRupees: toRupees(dto.convenience_fees_paise ?? 0),
    convenienceFeeGstRupees: toRupees(dto.convenience_fee_gst_paise ?? 0),
    carriedAdjustmentsRupees: toRupees(dto.carried_adjustments_paise ?? 0),
    ledgerNetRupees: toRupees(dto.ledger_net_paise ?? 0),
    bookingsCount: dto.bookings_count ?? 0,
    entries: dto.entries ?? 0,
    lateEntries: dto.late_entries ?? 0,
    expectedNetRupees: toRupeesOrNull(dto.expected_net_paise),
    differenceRupees: toRupeesOrNull(dto.difference_paise),
    reconciled: dto.reconciled ?? null,
  };
}

const adjustmentSchema = z.object({
  id: z.string(),
  amount_paise: z.number(),
  reason: z.string(),
  carried_forward: z.boolean().optional(),
  created_at: z.string(),
});

export const adjustmentResponseSchema = adjustmentSchema;

export function toAdjustment(dto: z.infer<typeof adjustmentSchema>): SettlementAdjustment {
  return {
    id: dto.id,
    amountRupees: toRupees(dto.amount_paise),
    reason: dto.reason,
    carriedForward: dto.carried_forward ?? false,
    createdAt: dto.created_at,
  };
}

const statementRefSchema = z.object({
  id: z.string(),
  statement_no: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  issued_at: z.string().nullable().optional(),
});

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
    initiatedById: dto.initiated_by_id ?? null,
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
    runNo: dto.run_no ?? null,
    runStatus: dto.run_status ?? null,
    hospitalName: dto.hospital_name ?? null,
    periodStart: dto.period_start ?? null,
    periodEnd: dto.period_end ?? null,
    bankAccountVerified: dto.bank_account_verified ?? null,
  };
}

export function toPayoutRunDetail(dto: PayoutRunDetailResponse): PayoutRunDetail {
  return { run: toPayoutRun(dto), payouts: dto.payouts.map(toPayout) };
}

/** `GET /platform/settlements/periods/{id}`. */
export const periodDetailResponseSchema = periodResponseSchema.extend({
  breakdown: breakdownSchema.nullable().optional(),
  adjustments: z.array(adjustmentSchema).optional(),
  payout: payoutResponseSchema.nullable().optional(),
  statement_id: z.string().nullable().optional(),
  statements: z.array(statementRefSchema).optional(),
});

export function toPeriodDetail(
  dto: z.infer<typeof periodDetailResponseSchema>,
): SettlementPeriodDetail {
  return {
    period: toSettlementPeriod(dto),
    closedAt: dto.closed_at ?? null,
    breakdown: dto.breakdown ? toBreakdown(dto.breakdown) : null,
    adjustments: (dto.adjustments ?? []).map(toAdjustment),
    payout: dto.payout ? toPayout(dto.payout) : null,
    statementId: dto.statement_id ?? null,
    statements: (dto.statements ?? []).map((s) => ({
      id: s.id,
      statementNo: s.statement_no,
      periodStart: s.period_start,
      periodEnd: s.period_end,
      issuedAt: s.issued_at ?? null,
    })),
  };
}

const closeSkipSchema = z.object({ hospital_id: z.string(), reason: z.string() });

const closePreviewRowSchema = z.object({
  hospital_id: z.string(),
  hospital_name: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  net_payable_paise: z.number(),
  breakdown: breakdownSchema.nullable().optional(),
});

/**
 * `POST /platform/settlements/periods/close`: `{dry_run: true, would_close,
 * skipped}` (200) or `{dry_run: false, closed, skipped}` (201). An older
 * backend sends `{closed, skipped}` with no `dry_run` — it closed for real.
 */
export const periodCloseResponseSchema = z.object({
  dry_run: z.boolean().optional(),
  would_close: z.array(closePreviewRowSchema).optional(),
  closed: z.array(periodResponseSchema).optional(),
  skipped: z.array(closeSkipSchema).optional(),
});

export function toPeriodCloseOutcome(
  dto: z.infer<typeof periodCloseResponseSchema>,
): PeriodCloseOutcome {
  const skipped = (dto.skipped ?? []).map((s) => ({ hospitalId: s.hospital_id, reason: s.reason }));
  if (dto.dry_run === true) {
    return {
      kind: 'preview',
      wouldClose: (dto.would_close ?? []).map((r) => ({
        hospitalId: r.hospital_id,
        hospitalName: r.hospital_name,
        periodStart: r.period_start,
        periodEnd: r.period_end,
        netPayableRupees: toRupees(r.net_payable_paise),
        breakdown: r.breakdown ? toBreakdown(r.breakdown) : null,
      })),
      skipped,
    };
  }
  return {
    kind: 'closed',
    closed: (dto.closed ?? []).map(toSettlementPeriod),
    skipped,
    legacy: dto.dry_run === undefined,
  };
}

export function toPayoutRunCreated(
  dto: z.infer<typeof payoutRunCreatedResponseSchema>,
): PayoutRunCreated {
  return {
    run: toPayoutRun(dto),
    skipped: (dto.skipped ?? []).map((s) => ({
      hospitalId: s.hospital_id,
      settlementPeriodId: s.settlement_period_id ?? null,
      netPayableRupees: toRupeesOrNull(s.net_payable_paise),
      reason: s.reason,
    })),
  };
}

/** The hospital snapshot on a statement, as far as the list reads it. */
const statementSnapshotSchema = z
  .object({ name: z.string().nullable().optional(), legal_name: z.string().nullable().optional() })
  .passthrough();

export const statementResponseSchema = z.object({
  id: z.string(),
  hospital_id: z.string(),
  statement_no: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  issued_at: z.string().nullable(),
  bookings_count: z.number().int(),
  gross_paise: z.number(),
  convenience_fees_paise: z.number(),
  convenience_fee_gst_paise: z.number(),
  commission_paise: z.number(),
  commission_gst_paise: z.number(),
  gateway_fees_paise: z.number(),
  refunds_paise: z.number(),
  net_payable_paise: z.number(),
  hospital_snapshot: statementSnapshotSchema.nullable().optional(),
});

export const statementPageResponseSchema = paginatedSchema(statementResponseSchema);

export function toPlatformStatement(
  dto: z.infer<typeof statementResponseSchema>,
): PlatformStatement {
  const snapshot = dto.hospital_snapshot;
  return {
    id: dto.id,
    hospitalId: dto.hospital_id,
    hospitalName: snapshot?.name || snapshot?.legal_name || null,
    statementNo: dto.statement_no,
    periodStart: dto.period_start,
    periodEnd: dto.period_end,
    issuedAt: dto.issued_at,
    bookingsCount: dto.bookings_count,
    grossRupees: toRupees(dto.gross_paise),
    convenienceFeesRupees: toRupees(dto.convenience_fees_paise),
    convenienceFeeGstRupees: toRupees(dto.convenience_fee_gst_paise),
    commissionRupees: toRupees(dto.commission_paise),
    commissionGstRupees: toRupees(dto.commission_gst_paise),
    gatewayFeesRupees: toRupees(dto.gateway_fees_paise),
    refundsRupees: toRupees(dto.refunds_paise),
    netPayableRupees: toRupees(dto.net_payable_paise),
  };
}

export const statementIssueResponseSchema = z.object({
  issued: z.array(statementResponseSchema),
  skipped: z.array(z.unknown()).optional(),
});

export function toStatementIssueResult(
  dto: z.infer<typeof statementIssueResponseSchema>,
): StatementIssueResult {
  return { issued: dto.issued.map(toPlatformStatement), skippedCount: dto.skipped?.length ?? 0 };
}

/** SET-02: a statement PDF is a short-lived signed link. */
export const statementPdfLinkSchema = z.object({
  url: z.string(),
  statement_no: z.string().optional(),
  expires_at: z.string().optional(),
});
