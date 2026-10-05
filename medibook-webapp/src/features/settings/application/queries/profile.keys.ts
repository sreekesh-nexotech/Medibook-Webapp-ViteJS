/** Query keys for Hospital Profile (H4) — standards §4, no inline key arrays. */
export const profileKeys = {
  all: ['hospital-profile'] as const,
  holidays: () => [...profileKeys.all, 'holidays'] as const,
  banners: () => [...profileKeys.all, 'banners'] as const,
  bannerImageUrl: (fileId: string) => [...profileKeys.all, 'banner-image-url', fileId] as const,
};

/** The calendar and banners change only from this screen; a minute keeps tabs in step. */
export const PROFILE_STALE_TIME_MS = 60_000;
