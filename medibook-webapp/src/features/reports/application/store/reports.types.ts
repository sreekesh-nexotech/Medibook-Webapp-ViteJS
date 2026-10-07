/**
 * Report view-model types (audit HA-13): the pre-rendered table cell, so one
 * table component can draw every report the server defines without knowing
 * what a row means.
 */

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
