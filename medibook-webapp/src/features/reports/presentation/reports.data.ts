/**
 * Presentation constants for the reports screen: the picker's categories,
 * their icon colours and the table page size. The reports themselves — their
 * filters, columns and KPIs — come from the server's catalogue
 * (`GET /hospital/reports`); nothing here describes a report (08 F15).
 */

export type ReportCategory = 'Operations' | 'Finance' | 'People';

export const REPORT_CATS: readonly string[] = ['All', 'Operations', 'Finance', 'People'];

/**
 * Design `CAT_STYLE` translated to token classes for the icon box
 * (`bg` + `c`): Operations → blue, Finance → g-600, People → p-500.
 */
export const CAT_ICON_CLASS: Record<ReportCategory, string> = {
  Operations: 'bg-blue-soft-bg text-blue',
  Finance: 'bg-g-100 text-g-600',
  People: 'bg-p-100 text-p-500',
};

/** Rows per page in every report table — the rhythm the payments table uses. */
export const REPORT_PAGE_SIZE = 10;
