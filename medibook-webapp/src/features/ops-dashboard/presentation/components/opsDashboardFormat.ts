/** Display helpers for the ops dashboard. Pure functions, no React. */

import { fmtDate, moneyShort, toLocalISO } from '@/shared/lib/format';

import { opsPath } from '@/app/router/paths';

const PAISE_PER_RUPEE = 100;

/** Characters of a UUID shown when the backend sends no hospital name. */
const SHORT_ID_LENGTH = 8;

/** Integer paise → compact KPI figure ("₹ 3.7L"). */
export function rupeesShort(paise: number): string {
  return moneyShort(Math.round(paise / PAISE_PER_RUPEE));
}

/** ISO date-time → the viewer's local calendar date ("5 Oct 2026"). */
export function fmtDateTime(iso: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? '—' : fmtDate(toLocalISO(at));
}

/** "a1b2c3d4-…" → "a1b2c3d4…". */
export function shortId(id: string): string {
  return id.length > SHORT_ID_LENGTH ? `${id.slice(0, SHORT_ID_LENGTH)}…` : id;
}

/**
 * Ops profile of a registry hospital by its UUID — the same `hospitals/:id`
 * href the P2 registry builds (`opsHospitalDetailPath` still takes the
 * fixture-era numeric id).
 */
export function hospitalHref(id: string): string {
  return `${opsPath('hospitals')}/${encodeURIComponent(id)}`;
}

/** `1` → "1 hospital", `2` → "2 hospitals". */
export function plural(n: number, noun: string): string {
  return `${n.toLocaleString('en-IN')} ${noun}${n === 1 ? '' : 's'}`;
}

/** Label + shared badge palette key for an onboarding stage. */
const STAGE_VIEW: Readonly<Record<string, readonly [string, string]>> = {
  application: ['Application', 'Submitted'],
  documents_pending: ['Documents pending', 'Pending'],
  review: ['In review', 'Pending verification'],
  approved: ['Approved', 'Verified'],
  live: ['Live', 'Live'],
  rejected: ['Rejected', 'Rejected'],
};

export function stageView(stage: string): { label: string; badge: string } {
  const view = STAGE_VIEW[stage];
  return view ? { label: view[0], badge: view[1] } : { label: stage, badge: stage };
}
