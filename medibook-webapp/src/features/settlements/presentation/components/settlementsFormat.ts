/** Display helpers for Billing & Settlements. Pure functions, no React. */

import { downloadFromUrl } from '@/shared/lib/download';
import { fmtDate, money, moneyShort, toLocalISO } from '@/shared/lib/format';

import type {
  InvoiceStatus,
  SubscriptionStatus,
  UsageMetric,
} from '@/features/settlements/domain/entities/billing.entities';
import type {
  PayoutStatus,
  SettlementPeriodStatus,
} from '@/features/settlements/domain/entities/settlements.entities';

const PAISE_PER_RUPEE = 100;
const BASIS_POINTS_PER_PERCENT = 100;
const PERCENT = 100;

/** The backend's storage unit (`limits.GB = 1024**3`). */
const BYTES_PER_GB = 1024 ** 3;

/** Give the browser a tick to start the transfer before revoking the blob URL. */
const REVOKE_DELAY_MS = 1000;

/** Integer paise → "₹ 1,23,456.5". */
export function rupees(paise: number): string {
  return money(paise / PAISE_PER_RUPEE);
}

/** Integer paise → compact KPI figure ("₹ 2.6L"). */
export function rupeesShort(paise: number): string {
  return moneyShort(Math.round(paise / PAISE_PER_RUPEE));
}

/** 1800 → "18%"; drops a trailing ".0". */
export function bpToPct(bp: number): string {
  const pct = bp / BASIS_POINTS_PER_PERCENT;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%`;
}

/**
 * The commission actually taken on a period, as a share of its gross. The
 * rate is per hospital and changes over time (`hospital_commission_history`),
 * so it is derived from the period's own figures, never a fixed constant.
 */
export function effectiveRate(partPaise: number, grossPaise: number): string {
  if (grossPaise <= 0) return '—';
  return `${((partPaise / grossPaise) * PERCENT).toFixed(1)}%`;
}

/** "2026-06-10", "2026-06-16" → "10 Jun 2026 – 16 Jun 2026". */
export function periodLabel(start: string, end: string): string {
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}

/** ISO date-time → the viewer's local calendar date ("5 Oct 2026"); em dash when absent. */
export function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? '—' : fmtDate(toLocalISO(at));
}

/** Label + badge palette key for a status the screen shows. */
export interface StatusView {
  readonly label: string;
  /** A key of the shared `STATUS` badge map. */
  readonly badge: string;
}

export const PERIOD_STATUS: Readonly<Record<SettlementPeriodStatus, StatusView>> = {
  open: { label: 'Accruing', badge: 'Open' },
  closed: { label: 'Awaiting payout', badge: 'Pending' },
  paid: { label: 'Paid', badge: 'Paid' },
  on_hold: { label: 'On Hold', badge: 'On Hold' },
};

export const PAYOUT_STATUS: Readonly<Record<PayoutStatus, StatusView>> = {
  pending: { label: 'Pending', badge: 'Pending' },
  released: { label: 'Released', badge: 'Released' },
  failed: { label: 'Payout failed', badge: 'Payout failed' },
  on_hold: { label: 'On Hold', badge: 'On Hold' },
};

const INVOICE_STATUS: Readonly<Record<InvoiceStatus, StatusView>> = {
  draft: { label: 'Draft', badge: 'Inactive' },
  issued: { label: 'Pending', badge: 'Pending' },
  paid: { label: 'Paid', badge: 'Paid' },
  overdue: { label: 'Overdue', badge: 'Overdue' },
  void: { label: 'Void', badge: 'Cancelled' },
  uncollectible: { label: 'Uncollectible', badge: 'Failed' },
};

const SUBSCRIPTION_STATUS: Readonly<Record<SubscriptionStatus, StatusView>> = {
  trialing: { label: 'Trial', badge: 'Scheduled' },
  active: { label: 'Active', badge: 'Active' },
  past_due: { label: 'Past due', badge: 'Overdue' },
  grace: { label: 'Grace period', badge: 'Pending' },
  read_only: { label: 'Read-only', badge: 'Suspended' },
  cancelled: { label: 'Cancelled', badge: 'Cancelled' },
};

/** Unknown future statuses render as themselves on the neutral pill. */
function lookup<K extends string>(
  map: Readonly<Record<K, StatusView>>,
  status: string,
): StatusView {
  return (
    (map as Readonly<Record<string, StatusView | undefined>>)[status] ?? {
      label: status,
      badge: status,
    }
  );
}

export function invoiceStatus(status: string): StatusView {
  return lookup(INVOICE_STATUS, status);
}

export function subscriptionStatus(status: string): StatusView {
  return lookup(SUBSCRIPTION_STATUS, status);
}

/** "monthly" → "Monthly". */
export function billingPeriodLabel(period: string): string {
  return period.charAt(0).toUpperCase() + period.slice(1);
}

export const USAGE_LABELS: Readonly<Record<UsageMetric, string>> = {
  users: 'Staff users',
  doctors: 'Doctors',
  storage: 'File storage',
};

/** A meter value in its natural unit: storage in GB, the rest as counts. */
export function usageValue(metric: UsageMetric, value: number): string {
  if (metric === 'storage') return `${(value / BYTES_PER_GB).toFixed(1)} GB`;
  return value.toLocaleString('en-IN');
}

/** Share of the limit used, 0–100, or `null` when unlimited. */
export function usagePct(current: number, limit: number | null): number | null {
  if (!limit) return null;
  return Math.min(PERCENT, Math.round((current / limit) * PERCENT));
}

/** Save a fetched file (e.g. a server-rendered PDF) to the user's disk. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  downloadFromUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
