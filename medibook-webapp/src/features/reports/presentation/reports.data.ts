/**
 * Report categories, their icon colours and the table page size, shared by
 * the reports screens. (The design's hard-coded report list that lived here
 * was unused and has been removed — PRD-12.)
 */

export type ReportCategory = 'Operations' | 'Finance' | 'People';

export const REPORT_CATS: readonly string[] = ['All', 'Operations', 'Finance', 'People'];

/**
 * Design `CAT_STYLE` translated to token classes for the icon box
 * (`bg` + `c`): Operations → blue, Finance → g-600, People → p-500.
 */
export const CAT_ICON_CLASS: Record<ReportCategory, string> = {
  Operations: 'bg-blue-soft-bg text-blue',
  Finance: 'bg-g-100 text-g-800',
  People: 'bg-p-100 text-p-500',
};

/** Rows per page in every report table — the rhythm the payments table uses. */
export const REPORT_PAGE_SIZE = 10;
