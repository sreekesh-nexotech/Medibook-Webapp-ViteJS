import type { OpsTint } from '@/shared/ui/OpsConfirm';
import type { IconName } from '@/shared/ui/icon-registry';

/**
 * Card dressing per report code — icon, accent tint and a one-line
 * description. The backend lists codes, titles and columns only; how a card
 * looks is presentation. A code the server adds later falls back to
 * `OPS_REPORT_CARD_FALLBACK` and still renders.
 */
export interface OpsReportCardMeta {
  readonly icon: IconName;
  readonly tint: OpsTint;
  readonly desc: string;
}

export const OPS_REPORT_CARD_FALLBACK: OpsReportCardMeta = {
  icon: 'file-text',
  tint: 'neutral',
  desc: 'Platform report export.',
};

export const OPS_REPORT_CARD_META: Readonly<Record<string, OpsReportCardMeta>> = {
  bookings: {
    icon: 'calendar-check',
    tint: 'primary',
    desc: 'All bookings with department and outcome detail.',
  },
  payment_collection: {
    icon: 'wallet',
    tint: 'success',
    desc: 'Payments collected per booking, with method and status.',
  },
  revenue: {
    icon: 'indian-rupee',
    tint: 'success',
    desc: 'Booking revenue by hospital, doctor and date.',
  },
  refund: {
    icon: 'undo-2',
    tint: 'warning',
    desc: 'Refunds on cancelled bookings, with reason and status.',
  },
  settlement: {
    icon: 'landmark',
    tint: 'info',
    desc: 'Payout history with commission breakdown.',
  },
  commission: {
    icon: 'percent',
    tint: 'info',
    desc: 'Commission rate and amount earned per hospital.',
  },
  commission_history: {
    icon: 'clock',
    tint: 'neutral',
    desc: 'Commission per hospital, date by date.',
  },
  hospital_performance: {
    icon: 'building-2',
    tint: 'primary',
    desc: 'Bookings, completions, cancellations and revenue per hospital.',
  },
  doctor_performance: {
    icon: 'stethoscope',
    tint: 'primary',
    desc: 'Bookings, completions and revenue per doctor.',
  },
  department: { icon: 'layers', tint: 'info', desc: 'Bookings and revenue per department.' },
  cancellation_no_show: {
    icon: 'calendar-x',
    tint: 'danger',
    desc: 'Cancelled and no-show bookings with reasons.',
  },
  user_activity: {
    icon: 'users',
    tint: 'primary',
    desc: 'End users with bookings, last activity and status.',
  },
  user_spend: {
    icon: 'credit-card',
    tint: 'success',
    desc: 'Total spend and bookings per end user.',
  },
  plan_usage: {
    icon: 'gauge',
    tint: 'info',
    desc: 'Plan booking limits, usage and overage per hospital.',
  },
  billing_invoice: {
    icon: 'receipt',
    tint: 'warning',
    desc: 'Hospital invoices with amount, status and due date.',
  },
  payment_status: {
    icon: 'circle-check',
    tint: 'success',
    desc: 'Every payment with its booking, amount and status.',
  },
  revenue_breakdown: {
    icon: 'trending-up',
    tint: 'success',
    desc: 'Per-booking fee, tax, commission and net.',
  },
  settlement_summary: {
    icon: 'banknote',
    tint: 'info',
    desc: 'Settled and pending totals per hospital.',
  },
  booking_source: {
    icon: 'smartphone',
    tint: 'primary',
    desc: 'Bookings by channel — app or walk-in.',
  },
  time_based_revenue: {
    icon: 'calendar-days',
    tint: 'success',
    desc: 'Revenue and bookings by date.',
  },
};
