import { z } from 'zod';

import type {
  OpsAlertHospital,
  OpsDashboard,
  OpsDashboardAlert,
} from '@/features/ops-dashboard/domain/entities/opsDashboard.entities';

/**
 * `GET /platform/dashboard`. `schema.yml` types the body as an untyped
 * `dict`; the shape below is `analytics/services/platform_dashboard.build()`.
 * Status counts are a lenient record so a new backend status never fails the
 * parse; missing known statuses default to 0.
 */

const countMapSchema = z.record(z.string(), z.number().int());

const alertHospitalSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  sessions: z.number().int().optional(),
});

const alertResponseSchema = z.object({
  code: z.string(),
  count: z.number().int(),
  hospitals: z.array(alertHospitalSchema).optional(),
  older_than_7_days: z.number().int().optional(),
});

export const opsDashboardResponseSchema = z.object({
  generated_at: z.string(),
  kpis: z.object({
    hospitals_by_status: countMapSchema,
    subscriptions_by_status: countMapSchema,
    mrr_paise: z.number().int(),
    invoices_unpaid_count: z.number().int(),
    invoices_outstanding_paise: z.number().int(),
    appointments_last_30_days: z.number().int(),
  }),
  alerts: z.array(alertResponseSchema),
  recent_onboardings: z.array(
    z.object({
      case_id: z.string(),
      stage: z.string(),
      hospital_id: z.string(),
      hospital_name: z.string(),
      created_at: z.string(),
    }),
  ),
});

type OpsDashboardResponse = z.infer<typeof opsDashboardResponseSchema>;
type AlertResponse = z.infer<typeof alertResponseSchema>;

function count(map: Readonly<Record<string, number>>, key: string): number {
  return map[key] ?? 0;
}

function toAlertHospitals(alert: AlertResponse): readonly OpsAlertHospital[] {
  return (alert.hospitals ?? []).map((h) => ({
    id: h.id,
    name: h.name ?? null,
    sessions: h.sessions ?? null,
  }));
}

function toAlert(alert: AlertResponse): OpsDashboardAlert {
  switch (alert.code) {
    case 'hospitals_in_grace':
    case 'hospitals_read_only':
    case 'unreconciled_cash_sessions':
      return { code: alert.code, count: alert.count, hospitals: toAlertHospitals(alert) };
    case 'dead_outbox_rows':
      return { code: alert.code, count: alert.count };
    case 'pending_onboarding':
      return {
        code: alert.code,
        count: alert.count,
        olderThan7Days: alert.older_than_7_days ?? 0,
      };
    default:
      return { code: 'unknown', rawCode: alert.code, count: alert.count };
  }
}

export function toOpsDashboard(dto: OpsDashboardResponse): OpsDashboard {
  const h = dto.kpis.hospitals_by_status;
  const s = dto.kpis.subscriptions_by_status;
  return {
    generatedAt: dto.generated_at,
    kpis: {
      hospitals: {
        draft: count(h, 'draft'),
        onboarding: count(h, 'onboarding'),
        active: count(h, 'active'),
        suspended: count(h, 'suspended'),
        closed: count(h, 'closed'),
      },
      subscriptions: {
        trialing: count(s, 'trialing'),
        active: count(s, 'active'),
        pastDue: count(s, 'past_due'),
        grace: count(s, 'grace'),
        readOnly: count(s, 'read_only'),
        cancelled: count(s, 'cancelled'),
      },
      mrrPaise: dto.kpis.mrr_paise,
      invoicesUnpaidCount: dto.kpis.invoices_unpaid_count,
      invoicesOutstandingPaise: dto.kpis.invoices_outstanding_paise,
      appointmentsLast30Days: dto.kpis.appointments_last_30_days,
    },
    alerts: dto.alerts.map(toAlert),
    recentOnboardings: dto.recent_onboardings.map((r) => ({
      caseId: r.case_id,
      stage: r.stage,
      hospitalId: r.hospital_id,
      hospitalName: r.hospital_name,
      createdAt: r.created_at,
    })),
  };
}
