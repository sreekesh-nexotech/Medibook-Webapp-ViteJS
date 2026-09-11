import { Icon } from '@/shared/ui/Icon';

interface PatientBannerThumbProps {
  /** Uploaded creative as a data URI; null renders the gradient placeholder. */
  img: string | null;
  title: string;
  /** Thumb width in px (data-driven size — hence style). */
  w?: number;
  /** Thumb height in px (data-driven size — hence style). */
  h?: number;
}

/**
 * Banner creative preview — the uploaded image, or a gradient placeholder.
 * Deliberately identical treatment to the operations console's `BannerThumb`,
 * so hospital-published and Medibook-published banners look like one feature.
 */
export function PatientBannerThumb({ img, title, w = 96, h = 48 }: PatientBannerThumbProps) {
  if (img) {
    return (
      <img
        src={img}
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
