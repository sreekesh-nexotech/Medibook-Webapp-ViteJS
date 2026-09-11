import { DEMO_TODAY_ISO } from '@/core/config/demo';

import type { PlanInvoice } from './settlements.types';

/**
 * Plan & Billing reference data — the subscription invoices Medibook raises to
 * the hospital, and the tax arithmetic behind them.
 *
 * Identifier formats are the cross-app canonical ones, so the hospital app and
 * the ops console cannot disagree about what an invoice looks like:
 *   - invoice series  `INV-2026-0001`  (ops → hospital)
 *   - receipt series  `MB/R/2026-27/000123`  (financial-year series)
 *   - GST            18%, always shown as its own line, never baked into a
 *                    displayed fee
 */

/** GST charged on the subscription fee. */
export const GST_RATE = 0.18;

/** Medibook's own GSTIN — the issuer of these invoices. */
export const MEDIBOOK_GSTIN = '27AABCM9407L1ZK';

/** The three parts of a GST-inclusive total, in whole rupees. */
export interface GstSplit {
  /** Taxable value before GST. */
  readonly taxable: number;
  /** The 18% GST component. */
  readonly gst: number;
  /** What the hospital paid (taxable + gst) — always equal to the input. */
  readonly total: number;
}

/**
 * Split a GST-inclusive total into taxable value + GST. The GST is computed as
 * the remainder, so the two lines always add back up to the printed total
 * (no rounding cent that makes an invoice look wrong).
 */
export function splitGst(total: number): GstSplit {
  const taxable = Math.round(total / (1 + GST_RATE));
  return { taxable, gst: total - taxable, total };
}

/** GST rate as the label invoices print, e.g. "18%". */
export const GST_LABEL = `${Math.round(GST_RATE * 100)}%`;

/**
 * The next subscription invoice date: the 1st of the month after `todayIso`.
 * Assembled from the date parts rather than through `toISOString()`, which
 * shifts a local-midnight date back a day in any timezone east of UTC — the
 * root cause of the app's yesterday-date defect.
 */
export function nextInvoiceDate(todayIso: string = DEMO_TODAY_ISO): string {
  const [y, m] = todayIso.split('-').map(Number);
  const year = m === 12 ? y + 1 : y;
  const month = m === 12 ? 1 : m + 1;
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/**
 * Plan invoice history for this tenant (design literal rows, renumbered onto
 * the canonical series). Amounts are the GST-inclusive totals charged.
 */
export const SEED_PLAN_INVOICES: readonly PlanInvoice[] = [
  {
    id: 'INV-2026-0003',
    receipt: 'MB/R/2026-27/000123',
    date: '2026-06-01',
    plan: 'Growth · Monthly',
    total: 24999,
    status: 'Paid',
    paidOn: '2026-06-01',
    mode: 'UPI',
  },
  {
    id: 'INV-2026-0002',
    receipt: 'MB/R/2026-27/000122',
    date: '2026-05-01',
    plan: 'Growth · Monthly',
    total: 24999,
    status: 'Paid',
    paidOn: '2026-05-02',
    mode: 'Netbanking',
  },
  {
    id: 'INV-2026-0001',
    receipt: 'MB/R/2026-27/000121',
    date: '2026-04-01',
    plan: 'Growth · Monthly',
    total: 24999,
    status: 'Paid',
    paidOn: '2026-04-01',
    mode: 'UPI',
  },
];
