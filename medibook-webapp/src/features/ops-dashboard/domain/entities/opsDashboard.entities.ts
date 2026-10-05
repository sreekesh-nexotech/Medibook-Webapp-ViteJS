/**
 * Ops dashboard entities (`GET /platform/dashboard`). Plain readonly types —
 * no React, no Axios, no Zod. Money is integer paise.
 */

/** Hospital lifecycle counts (backend `Hospital.Status`). */
export interface HospitalStatusCounts {
  readonly draft: number;
  readonly onboarding: number;
  readonly active: number;
  readonly suspended: number;
  readonly closed: number;
}

/** Subscription counts (backend `HospitalSubscription.Status`). */
export interface SubscriptionStatusCounts {
  readonly trialing: number;
  readonly active: number;
  readonly pastDue: number;
  readonly grace: number;
  readonly readOnly: number;
  readonly cancelled: number;
}

export interface OpsDashboardKpis {
  readonly hospitals: HospitalStatusCounts;
  readonly subscriptions: SubscriptionStatusCounts;
  /** Monthly recurring revenue of live subscriptions; yearly plans count as price / 12. */
  readonly mrrPaise: number;
  readonly invoicesUnpaidCount: number;
  readonly invoicesOutstandingPaise: number;
  readonly appointmentsLast30Days: number;
}

/** A hospital an alert names (cash-session alerts carry no name, only a session count). */
export interface OpsAlertHospital {
  readonly id: string;
  readonly name: string | null;
  readonly sessions: number | null;
}

/**
 * One computed alert. Alerts are conditions the backend re-evaluates on every
 * read — they clear when the condition does, and cannot be dismissed.
 */
export type OpsDashboardAlert =
  | {
      readonly code: 'hospitals_in_grace' | 'hospitals_read_only' | 'unreconciled_cash_sessions';
      readonly count: number;
      readonly hospitals: readonly OpsAlertHospital[];
    }
  | { readonly code: 'dead_outbox_rows'; readonly count: number }
  | { readonly code: 'pending_onboarding'; readonly count: number; readonly olderThan7Days: number }
  | { readonly code: 'unknown'; readonly rawCode: string; readonly count: number };

/** Backend `OnboardingCase.Stage`; unknown future stages pass through as strings. */
export type OnboardingStage =
  'application' | 'documents_pending' | 'review' | 'approved' | 'live' | 'rejected';

export interface RecentOnboarding {
  readonly caseId: string;
  readonly stage: OnboardingStage | string;
  readonly hospitalId: string;
  readonly hospitalName: string;
  /** ISO date-time the case was opened. */
  readonly createdAt: string;
}

export interface OpsDashboard {
  readonly generatedAt: string;
  readonly kpis: OpsDashboardKpis;
  readonly alerts: readonly OpsDashboardAlert[];
  readonly recentOnboardings: readonly RecentOnboarding[];
}
