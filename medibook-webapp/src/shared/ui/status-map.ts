/**
 * Status pill palette — every hospital-side status from the design's `ui.jsx`
 * STATUS map plus the ops-console extension `Ops.jsx` applies on top
 * (`Object.assign(STATUS, {...})`), translated from CSS variables to Tailwind
 * class pairs. Consumed by `Badge`; unknown statuses fall back to Scheduled
 * styling inside `Badge`, exactly like the prototype.
 *
 * Badge text is 12.5px, so every pair here must clear 4.5:1. The neutral
 * pills use `text-grey-900` on `bg-grey-300` (6.90:1) rather than
 * `text-text-muted`, which measured 4.32:1 and failed.
 */
export const STATUS = {
  // ── hospital side (ui.jsx) ──
  'In Queue': { bg: 'bg-badge-queue-bg', fg: 'text-badge-queue-fg' },
  Completed: { bg: 'bg-badge-completed-bg', fg: 'text-badge-completed-fg' },
  Scheduled: { bg: 'bg-badge-scheduled-bg', fg: 'text-badge-scheduled-fg' },
  'Checked-in': { bg: 'bg-g-100', fg: 'text-g-700' },
  Cancelled: { bg: 'bg-badge-cancelled-bg', fg: 'text-badge-cancelled-fg' },
  'No-show': { bg: 'bg-badge-noshow-bg', fg: 'text-badge-noshow-fg' },
  Paid: { bg: 'bg-badge-completed-bg', fg: 'text-badge-completed-fg' },
  Pending: { bg: 'bg-badge-queue-bg', fg: 'text-badge-queue-fg' },
  Refunded: { bg: 'bg-badge-cancelled-bg', fg: 'text-badge-cancelled-fg' },
  Waived: { bg: 'bg-grey-300', fg: 'text-grey-900' },
  Failed: { bg: 'bg-badge-cancelled-bg', fg: 'text-badge-cancelled-fg' },
  Settled: { bg: 'bg-badge-completed-bg', fg: 'text-badge-completed-fg' },
  Received: { bg: 'bg-badge-completed-bg', fg: 'text-badge-completed-fg' },
  Requested: { bg: 'bg-badge-queue-bg', fg: 'text-badge-queue-fg' },
  'On Hold': { bg: 'bg-badge-noshow-bg', fg: 'text-badge-noshow-fg' },
  Overdue: { bg: 'bg-badge-cancelled-bg', fg: 'text-badge-cancelled-fg' },
  Unsettled: { bg: 'bg-badge-noshow-bg', fg: 'text-badge-noshow-fg' },
  Active: { bg: 'bg-badge-completed-bg', fg: 'text-badge-completed-fg' },
  'On Leave': { bg: 'bg-badge-queue-bg', fg: 'text-badge-queue-fg' },
  Inactive: { bg: 'bg-grey-300', fg: 'text-grey-900' },
  'Walk-in': { bg: 'bg-badge-noshow-bg', fg: 'text-badge-noshow-fg' },
  Medibook: { bg: 'bg-badge-scheduled-bg', fg: 'text-badge-scheduled-fg' },
  Open: { bg: 'bg-badge-queue-bg', fg: 'text-badge-queue-fg' },
  Resolved: { bg: 'bg-badge-completed-bg', fg: 'text-badge-completed-fg' },
  // ── ops console extension (Ops.jsx) ──
  Live: { bg: 'bg-badge-completed-bg', fg: 'text-badge-completed-fg' },
  Paused: { bg: 'bg-grey-300', fg: 'text-grey-900' },
  Expired: { bg: 'bg-grey-300', fg: 'text-grey-900' },
  Sent: { bg: 'bg-badge-completed-bg', fg: 'text-badge-completed-fg' },
  Queued: { bg: 'bg-badge-scheduled-bg', fg: 'text-badge-scheduled-fg' },
  'Pending verification': { bg: 'bg-badge-queue-bg', fg: 'text-badge-queue-fg' },
  Suspended: { bg: 'bg-grey-300', fg: 'text-grey-900' },
  Rejected: { bg: 'bg-badge-cancelled-bg', fg: 'text-badge-cancelled-fg' },
  Released: { bg: 'bg-badge-completed-bg', fg: 'text-badge-completed-fg' },
  'Payout failed': { bg: 'bg-badge-cancelled-bg', fg: 'text-badge-cancelled-fg' },
  'Payment failed': { bg: 'bg-badge-cancelled-bg', fg: 'text-badge-cancelled-fg' },
  Success: { bg: 'bg-badge-completed-bg', fg: 'text-badge-completed-fg' },
  Blocked: { bg: 'bg-grey-300', fg: 'text-grey-900' },
  Critical: { bg: 'bg-badge-cancelled-bg', fg: 'text-badge-cancelled-fg' },
  Warning: { bg: 'bg-badge-queue-bg', fg: 'text-badge-queue-fg' },
  Info: { bg: 'bg-badge-scheduled-bg', fg: 'text-badge-scheduled-fg' },
  Enabled: { bg: 'bg-badge-completed-bg', fg: 'text-badge-completed-fg' },
  Verified: { bg: 'bg-badge-completed-bg', fg: 'text-badge-completed-fg' },
  Submitted: { bg: 'bg-badge-queue-bg', fg: 'text-badge-queue-fg' },
  Missing: { bg: 'bg-badge-cancelled-bg', fg: 'text-badge-cancelled-fg' },
} as const satisfies Record<string, { bg: string; fg: string }>;

export type StatusKey = keyof typeof STATUS;
