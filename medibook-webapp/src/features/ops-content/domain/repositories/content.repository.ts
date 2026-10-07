import type { Result } from '@/core/error/failure';

import type {
  AmbulanceDraft,
  AmbulanceProvider,
  ContentLocation,
  FaqDraft,
  FaqEntry,
  LegalDocument,
  LegalDraft,
  LegalSlug,
  LocationDraft,
} from '@/features/ops-content/domain/entities/content.entities';

/** Patient-app content on the platform surface (`settings.*`). */
export interface ContentRepository {
  /** Every version of every legal document, newest version first per slug. */
  listLegalDocuments(): Promise<Result<readonly LegalDocument[]>>;
  /** A new draft (version n+1) of a slug. */
  createLegalDraft(draft: LegalDraft): Promise<Result<LegalDocument>>;
  /** Edit an unpublished draft. */
  updateLegalDraft(
    id: string,
    changes: Pick<LegalDraft, 'title' | 'bodyMd'>,
  ): Promise<Result<LegalDocument>>;
  /** Publish the latest draft of `slug`; it becomes the current version. */
  publishLegalDraft(slug: LegalSlug): Promise<Result<LegalDocument>>;

  listFaqs(): Promise<Result<readonly FaqEntry[]>>;
  createFaq(draft: FaqDraft): Promise<Result<FaqEntry>>;
  updateFaq(id: string, draft: FaqDraft, version: number): Promise<Result<FaqEntry>>;
  deleteFaq(id: string, version: number): Promise<Result<null>>;

  listLocations(): Promise<Result<readonly ContentLocation[]>>;
  createLocation(draft: LocationDraft): Promise<Result<ContentLocation>>;
  updateLocation(
    id: string,
    draft: LocationDraft,
    version: number,
  ): Promise<Result<ContentLocation>>;
  deleteLocation(id: string, version: number): Promise<Result<null>>;

  listAmbulanceProviders(): Promise<Result<readonly AmbulanceProvider[]>>;
  createAmbulanceProvider(draft: AmbulanceDraft): Promise<Result<AmbulanceProvider>>;
  updateAmbulanceProvider(
    id: string,
    draft: AmbulanceDraft,
    version: number,
  ): Promise<Result<AmbulanceProvider>>;
  deleteAmbulanceProvider(id: string, version: number): Promise<Result<null>>;
}
