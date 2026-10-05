/** Query keys for the patient-app notifications screen. */
export const notificationsKeys = {
  all: ['ops-notifications'] as const,
  banners: () => [...notificationsKeys.all, 'banners'] as const,
  bannerImage: (fileId: string) => [...notificationsKeys.all, 'banner-image', fileId] as const,
};
