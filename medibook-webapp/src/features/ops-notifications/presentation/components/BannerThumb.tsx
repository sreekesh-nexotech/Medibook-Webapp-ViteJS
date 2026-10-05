import { Icon } from '@/shared/ui/Icon';

import { useBannerImageUrlQuery } from '@/features/ops-notifications/application/queries/useBannerImageUrlQuery';

interface BannerThumbProps {
  /** Creative as a URL / data URI; null renders the gradient placeholder. */
  img?: string | null;
  /** Stored creative to show via a signed link (used when `img` is not set). */
  fileId?: string | null;
  title: string;
  /** Thumb width in px (data-driven size — hence style). */
  w?: number;
  /** Thumb height in px (data-driven size — hence style). */
  h?: number;
}

/**
 * Banner creative preview — the image, or a gradient image placeholder while
 * there is none (or its signed link is still loading / not yet scanned).
 */
export function BannerThumb({
  img = null,
  fileId = null,
  title,
  w = 96,
  h = 48,
}: BannerThumbProps) {
  const signed = useBannerImageUrlQuery(img ? null : fileId);
  const src = img ?? signed.data ?? null;
  if (src) {
    return (
      <img
        src={src}
        alt={title}
        className="border-border-soft flex-none rounded-md border object-cover"
        style={{ width: w, height: h }}
      />
    );
  }
  return (
    <div
      className="border-border-soft from-blue-soft-bg to-p-100 text-text-navy flex flex-none items-center justify-center rounded-md border bg-linear-120"
      style={{ width: w, height: h }}
    >
      <Icon name="image" size={Math.min(20, h - 12)} />
    </div>
  );
}
