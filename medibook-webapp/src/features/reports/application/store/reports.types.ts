/**
 * A table cell, already rendered down to what the screen must draw. Keeping
 * the cell dumb is what lets one table component serve every report.
 */
export type ReportCell =
  | {
      readonly kind: 'text';
      readonly text: string;
      readonly sub?: string;
      readonly strong?: boolean;
    }
  | { readonly kind: 'num'; readonly text: string; readonly sub?: string }
  | { readonly kind: 'badge'; readonly status: string; readonly label?: string };
