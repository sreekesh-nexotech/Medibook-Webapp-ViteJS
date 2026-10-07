/**
 * The hospital notification bell as the server computes it (DASH-03,
 * `GET /hospital/notifications`): live counts for what the signed-in staff
 * member's role can act on, each with its own read state. Plain readonly
 * types.
 */

/** Bell items the backend knows today (`analytics.models.AlertKey`). */
export type HospitalAlertKey =
  | 'pending_approvals'
  | 'pending_patient_changes'
  | 'unpaid_walk_ins_today'
  | 'cash_sessions_to_reconcile'
  | 'settlements_on_hold'
  | 'settlements_awaiting_payout';

export interface HospitalAlertItem {
  /** A `HospitalAlertKey`, or a key a newer backend added (shown by its label). */
  readonly key: string;
  readonly label: string;
  readonly count: number;
  /** Newest row in the item; a newer one than `readAt` makes it unread again. */
  readonly latestAt: string | null;
  /** Money behind the settlement items. */
  readonly amountPaise: number | null;
  readonly read: boolean;
  readonly readAt: string | null;
}

export interface HospitalAlertFeed {
  readonly items: readonly HospitalAlertItem[];
  readonly unreadCount: number;
}
