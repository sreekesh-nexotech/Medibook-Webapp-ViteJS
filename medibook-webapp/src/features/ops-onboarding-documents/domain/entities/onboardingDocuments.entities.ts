/**
 * The physical documents a hospital hands over during onboarding (Q66) —
 * collected and ticked off by the onboarding team, never uploaded for
 * approval. Each hospital's checklist is copied from the items required by
 * default when it is onboarded.
 */

export interface DocumentRequirement {
  readonly id: string;
  /** Stable key the checklists refer to; fixed once created and never reused. */
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  /** On every new hospital's checklist. */
  readonly isRequiredDefault: boolean;
  /** Lower shows first. */
  readonly sortOrder: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** `If-Match` token. */
  readonly version: number;
}

export interface DocumentRequirementDraft {
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly isRequiredDefault: boolean;
  readonly sortOrder: number;
}
