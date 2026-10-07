/**
 * Patient-app content the operations console curates (`settings.*`):
 * versioned legal documents, FAQs, the location list and ambulance providers
 * (v2 §4.2, `/platform/legal-documents`, `/faqs`, `/locations`,
 * `/ambulance-providers`). Plain readonly types.
 */

/** The legal documents the patient app shows and consents record (backend `Slug`). */
export type LegalSlug = 'terms' | 'privacy' | 'guidelines';

export const LEGAL_SLUGS: readonly LegalSlug[] = ['terms', 'privacy', 'guidelines'];

/**
 * One version of a legal document. A draft (`publishedAt` null) can be
 * edited; a published version is immutable because consents record it.
 */
export interface LegalDocument {
  readonly id: string;
  readonly slug: LegalSlug;
  readonly version: number;
  readonly title: string;
  /** Markdown source. */
  readonly bodyMd: string;
  readonly publishedAt: string | null;
  /** The version patients see now (one per slug). */
  readonly isCurrent: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LegalDraft {
  readonly slug: LegalSlug;
  readonly title: string;
  readonly bodyMd: string;
}

/** Who reads an FAQ: the patient app, the hospital console, or both (B9, BE-34). */
export type FaqAudience = 'patient' | 'hospital' | 'all';

export interface FaqEntry {
  readonly id: string;
  readonly category: string;
  readonly question: string;
  readonly answerMd: string;
  readonly sortOrder: number;
  readonly isPublished: boolean;
  /** `null` on a backend without FAQ audiences (then: patient app). */
  readonly audience: FaqAudience | null;
  readonly rowVersion: number;
}

export interface FaqDraft {
  readonly category: string;
  readonly question: string;
  readonly answerMd: string;
  readonly sortOrder: number;
  readonly isPublished: boolean;
  /** Sent only when the backend has audiences. */
  readonly audience: FaqAudience | null;
}

/** A city/area the patient app offers for search (unique per city + area). */
export interface ContentLocation {
  readonly id: string;
  readonly city: string;
  readonly area: string;
  readonly state: string;
  /** Decimal degrees as the backend sends them (strings, 6 places); null when unset. */
  readonly lat: string | null;
  readonly lng: string | null;
  readonly isPopular: boolean;
  readonly isActive: boolean;
  readonly rowVersion: number;
}

export interface LocationDraft {
  readonly city: string;
  readonly area: string;
  readonly state: string;
  readonly lat: string | null;
  readonly lng: string | null;
  readonly isPopular: boolean;
  readonly isActive: boolean;
}

/** A platform-curated ambulance service the patient app lists (Q125–126). */
export interface AmbulanceProvider {
  readonly id: string;
  readonly locationId: string | null;
  readonly name: string;
  readonly phoneE164: string;
  readonly etaMinutes: number | null;
  readonly serviceArea: string | null;
  readonly isActive: boolean;
  readonly rowVersion: number;
}

export interface AmbulanceDraft {
  readonly locationId: string | null;
  readonly name: string;
  readonly phoneE164: string;
  readonly etaMinutes: number | null;
  readonly serviceArea: string | null;
  readonly isActive: boolean;
}
