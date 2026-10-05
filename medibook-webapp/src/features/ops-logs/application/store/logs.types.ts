/**
 * Compliance-log display vocabulary. The backend has no severity yet (P9 gap),
 * so the screen shows every entry as Info and the severity filter is inert.
 */

/** Severity of an audit-trail entry. */
export type LogSeverity = 'Info' | 'Warning' | 'Critical';
