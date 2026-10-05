import { getFile, getFileUrl, uploadFile } from '@/core/api/files.api';
import type { FileStatus } from '@/core/api/files.types';
import { attempt } from '@/core/error/attempt';
import { unwrap } from '@/core/error/failure';
import { clientFailure } from '@/core/error/toFailure';

import type { CampaignBanner } from '@/features/ops-notifications/domain/entities/notifications.entities';
import type { NotificationsRepository } from '@/features/ops-notifications/domain/repositories/notifications.repository';
import {
  deleteBanner,
  getBannersPage,
  patchBanner,
  postBanner,
} from '@/features/ops-notifications/infrastructure/data-sources/remote/notifications.api';
import {
  toCreateRequest,
  toPatchRequest,
} from '@/features/ops-notifications/infrastructure/data-sources/remote/notifications.request';
import { toCampaignBanner } from '@/features/ops-notifications/infrastructure/data-sources/remote/notifications.response';

/** How often to re-read an uploaded creative while its virus scan runs. */
const SCAN_POLL_INTERVAL_MS = 2_000;

/**
 * How long a save waits for the scan. The backend attaches an unscanned file,
 * so past this the banner is saved anyway and its thumb appears once clean.
 */
const SCAN_WAIT_MAX_MS = 30_000;

const REJECTED: ReadonlySet<FileStatus> = new Set(['infected', 'scan_failed']);

const IMAGE_REJECTED_MESSAGE = 'That image did not pass the virus scan. Choose another image.';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll the file until it is clean (resolves), rejected (throws) or the wait runs out. */
async function waitForScan(fileId: string): Promise<void> {
  const deadline = Date.now() + SCAN_WAIT_MAX_MS;
  for (;;) {
    const file = unwrap(await getFile(fileId));
    if (file.status === 'clean') return;
    if (REJECTED.has(file.status)) {
      throw clientFailure('validation', IMAGE_REJECTED_MESSAGE, 'FILE_REJECTED');
    }
    if (Date.now() >= deadline) return;
    await sleep(SCAN_POLL_INTERVAL_MS);
  }
}

export const notificationsRepository: NotificationsRepository = {
  listBanners: () =>
    attempt(async () => {
      const banners: CampaignBanner[] = [];
      for (let page = 1; ; page += 1) {
        const dto = await getBannersPage(page);
        banners.push(...dto.results.map(toCampaignBanner));
        if (!dto.has_next) return banners;
      }
    }),

  createBanner: (fields, sortOrder) =>
    attempt(async () => toCampaignBanner(await postBanner(toCreateRequest(fields, sortOrder)))),

  updateBanner: (id, version, patch) =>
    attempt(async () => toCampaignBanner(await patchBanner(id, version, toPatchRequest(patch)))),

  deleteBanner: (id, version) =>
    attempt(async () => {
      await deleteBanner(id, version);
      return null;
    }),

  uploadBannerImage: (file) =>
    attempt(async () => {
      const stored = unwrap(await uploadFile({ file, purpose: 'banner' }));
      await waitForScan(stored.id);
      return stored.id;
    }),

  getBannerImageUrl: (fileId) => attempt(async () => unwrap(await getFileUrl(fileId)).url),
};
