/**
 * Onboarding document catalogue rules: the checks a requirement must pass
 * before it is sent, and the checklist order. Pure functions.
 */
import type {
  DocumentRequirement,
  DocumentRequirementDraft,
} from '@/features/ops-onboarding-documents/domain/entities/onboardingDocuments.entities';

/** Lower-case words joined by underscores, like the seeded `reg_certificate`. */
const CODE_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

export type RequirementErrors = Partial<Record<keyof DocumentRequirementDraft, string>>;

export function requirementErrors(
  draft: DocumentRequirementDraft,
  existing: readonly DocumentRequirement[],
  editingId: string | null,
): RequirementErrors {
  const e: RequirementErrors = {};
  const code = draft.code.trim();
  if (editingId === null) {
    if (!CODE_PATTERN.test(code)) {
      e.code = 'Lower-case letters, digits and underscores, e.g. fire_noc.';
    } else if (existing.some((r) => r.code === code)) {
      e.code = 'This code is already in the catalogue.';
    }
  }
  if (draft.name.trim() === '') e.name = 'Name the document.';
  if (!Number.isInteger(draft.sortOrder)) e.sortOrder = 'Order is a whole number.';
  return e;
}

export function hasRequirementErrors(e: RequirementErrors): boolean {
  return Object.values(e).some(Boolean);
}

/** Checklist order: sort order, then code (the server's default order). */
export function inChecklistOrder(
  rows: readonly DocumentRequirement[],
): readonly DocumentRequirement[] {
  return [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
}

/** The order a new item gets: after the last one. */
export function nextSortOrder(rows: readonly DocumentRequirement[]): number {
  return rows.reduce((max, r) => Math.max(max, r.sortOrder + 1), 0);
}

/** `"12"` → 12; `undefined` when not a whole number. */
export function parseSortOrder(text: string): number | undefined {
  const t = text.trim();
  return /^-?[0-9]+$/.test(t) ? Number(t) : undefined;
}
