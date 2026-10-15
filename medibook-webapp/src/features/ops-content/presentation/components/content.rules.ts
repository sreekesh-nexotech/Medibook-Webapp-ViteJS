/**
 * Patient-app content rules: how legal versions group per document, and the
 * checks a draft must pass before it is sent (the backend's model limits).
 * Pure functions.
 */
import type {
  AmbulanceDraft,
  FaqAudience,
  FaqDraft,
  LegalDocument,
  LegalSlug,
  LocationDraft,
} from '@/features/ops-content/domain/entities/content.entities';

export const LEGAL_SLUG_LABEL: Readonly<Record<LegalSlug, string>> = {
  terms: 'Terms of use',
  privacy: 'Privacy policy',
  guidelines: 'Community guidelines',
};

export const FAQ_AUDIENCE_LABEL: Readonly<Record<FaqAudience, string>> = {
  patient: 'Patient app',
  hospital: 'Hospital console',
  all: 'Patient app and hospital console',
};

export const FAQ_AUDIENCES: readonly FaqAudience[] = ['patient', 'hospital', 'all'];

/** One legal document's versions: what patients see, the draft in progress, and the rest. */
export interface LegalDocumentVersions {
  readonly slug: LegalSlug;
  readonly current: LegalDocument | null;
  /** The newest unpublished version, which `publish` would make current. */
  readonly draft: LegalDocument | null;
  /** Every version, newest first. */
  readonly history: readonly LegalDocument[];
}

export function legalVersionsBySlug(
  docs: readonly LegalDocument[],
  slugs: readonly LegalSlug[],
): readonly LegalDocumentVersions[] {
  return slugs.map((slug) => {
    const history = docs.filter((d) => d.slug === slug).sort((a, b) => b.version - a.version);
    const newest = history[0] ?? null;
    return {
      slug,
      current: history.find((d) => d.isCurrent) ?? null,
      draft: newest && newest.publishedAt === null ? newest : null,
      history,
    };
  });
}

/* ------------------------------------------------------------- validation */

export type DraftErrors<T> = Partial<Record<keyof T, string>>;

const E164_PATTERN = /^\+[1-9][0-9]{7,14}$/;
const DECIMAL_PATTERN = /^-?[0-9]{1,3}(\.[0-9]{1,6})?$/;
const LAT_LIMIT = 90;
const LNG_LIMIT = 180;

function coordinateError(value: string | null, limit: number, label: string): string | null {
  if (value === null || value.trim() === '') return null;
  const v = value.trim();
  if (!DECIMAL_PATTERN.test(v)) return `${label}: up to 6 decimal places, e.g. 9.981636.`;
  return Math.abs(Number(v)) > limit ? `${label} must be between -${limit} and ${limit}.` : null;
}

export function faqErrors(d: FaqDraft): DraftErrors<FaqDraft> {
  const e: DraftErrors<FaqDraft> = {};
  if (d.category.trim() === '') e.category = 'Give the FAQ a category, e.g. Bookings.';
  if (d.question.trim() === '') e.question = 'Write the question.';
  if (d.answerMd.trim() === '') e.answerMd = 'Write the answer.';
  if (!Number.isInteger(d.sortOrder)) e.sortOrder = 'Order is a whole number.';
  return e;
}

export function locationErrors(d: LocationDraft): DraftErrors<LocationDraft> {
  const e: DraftErrors<LocationDraft> = {};
  if (d.city.trim() === '') e.city = 'Enter the city.';
  if (d.area.trim() === '') e.area = 'Enter the area.';
  if (d.state.trim() === '') e.state = 'Enter the state.';
  const lat = coordinateError(d.lat, LAT_LIMIT, 'Latitude');
  const lng = coordinateError(d.lng, LNG_LIMIT, 'Longitude');
  if (lat) e.lat = lat;
  if (lng) e.lng = lng;
  const hasLat = d.lat !== null && d.lat.trim() !== '';
  const hasLng = d.lng !== null && d.lng.trim() !== '';
  if (hasLat !== hasLng) e[hasLat ? 'lng' : 'lat'] = 'Enter both coordinates, or neither.';
  return e;
}

export function ambulanceErrors(d: AmbulanceDraft): DraftErrors<AmbulanceDraft> {
  const e: DraftErrors<AmbulanceDraft> = {};
  if (d.name.trim() === '') e.name = 'Enter the provider’s name.';
  if (!E164_PATTERN.test(d.phoneE164.replace(/\s/g, ''))) {
    e.phoneE164 = 'Enter the number in international format, e.g. +914842000108.';
  }
  if (d.etaMinutes !== null && (!Number.isInteger(d.etaMinutes) || d.etaMinutes < 0)) {
    e.etaMinutes = 'Arrival time is whole minutes, 0 or more.';
  }
  return e;
}

export function hasDraftErrors<T>(e: DraftErrors<T>): boolean {
  return Object.values(e).some(Boolean);
}

/** `"12"` → 12, `""` → null; `undefined` (not a whole number) is reported by the caller. */
export function parseOptionalInt(text: string): number | null | undefined {
  const t = text.trim();
  if (t === '') return null;
  return /^-?[0-9]+$/.test(t) ? Number(t) : undefined;
}
