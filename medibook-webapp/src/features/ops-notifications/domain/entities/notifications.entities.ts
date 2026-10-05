/**
 * Patient-app campaign banner entities (`/platform/banners`). Plain readonly
 * types — no React, no Axios, no Zod.
 */

/** A platform-wide banner on the patient app home screen. */
export interface CampaignBanner {
  readonly id: string;
  readonly title: string;
  /** Stored creative (`/shared/files`); null renders the gradient thumb. */
  readonly imageFileId: string | null;
  /** First live day (local `yyyy-mm-dd`); null = live from creation. */
  readonly from: string | null;
  /** Last live day (local `yyyy-mm-dd`); null = never expires. */
  readonly to: string | null;
  /** False while paused out of rotation (the schedule is kept). */
  readonly active: boolean;
  /** Rotation priority — lower shows first. */
  readonly sortOrder: number;
  /** Row version, sent as `If-Match` on every write. */
  readonly version: number;
}

/** What the editor does with the banner's creative on save. */
export type BannerImageChange =
  | { readonly kind: 'keep' }
  | { readonly kind: 'remove' }
  | { readonly kind: 'upload'; readonly file: File };

/** Banner editor payload (title + creative + campaign window). */
export interface BannerDraft {
  readonly title: string;
  readonly from: string;
  readonly to: string;
  readonly image: BannerImageChange;
}

/** Fields written on create / edit, after the creative is resolved to a file id. */
export interface BannerFields {
  readonly title: string;
  readonly imageFileId: string | null;
  readonly from: string | null;
  readonly to: string | null;
}

/** A partial banner write (`PATCH`). */
export interface BannerPatch {
  readonly title?: string;
  readonly imageFileId?: string | null;
  readonly from?: string | null;
  readonly to?: string | null;
  readonly active?: boolean;
  readonly sortOrder?: number;
}
