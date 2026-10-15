/**
 * Shapes the Hospital Settings sections share with the editor shell. The
 * shell owns the drafts; each section reads its slice and reports edits.
 */

/** Set one field of a section's draft. */
export type FieldSetter<T> = <K extends keyof T>(key: K, value: T[K]) => void;

/** The message to show under each field that needs fixing. */
export type FieldErrorsOf<T> = Partial<Record<keyof T, string>>;

/** One section's draft as a section component receives it. */
export interface SectionDraft<T> {
  readonly value: T;
  readonly set: FieldSetter<T>;
  readonly errors: FieldErrorsOf<T>;
}

/** The editor's left-hand sections, in order. */
export type SettingsSection =
  | 'General'
  | 'Booking & Cancellation'
  | 'Queue & Tokens'
  | 'Numbering'
  | 'Receipts & Printing'
  | 'Counters'
  | 'Display Screens'
  | 'Working Hours'
  | 'Bank & Payouts'
  | 'Management'
  | 'Notifications';
