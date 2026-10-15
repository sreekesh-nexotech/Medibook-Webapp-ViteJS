import { Icon } from '@/shared/ui/Icon';
import type { IconName } from '@/shared/ui/icon-registry';

interface ImageUploadProps {
  label?: string;
  hint?: string;
  /** Placeholder width — px number or CSS size (design default "100%"; dynamic, hence style). */
  w?: number | string;
  /** Placeholder height — px number or CSS size (design default 120; dynamic, hence style). */
  h?: number | string;
  icon?: IconName;
}

/**
 * Dashed image placeholder, shown where no image is set yet. It is not a
 * control: the upload is the file input it sits inside (PRD-03 — it used to
 * be a button that only said "demo").
 */
export function ImageUpload({
  label = 'Upload image',
  hint,
  w = '100%',
  h = 120,
  icon = 'image-plus',
}: ImageUploadProps) {
  return (
    <span
      className="border-border bg-bg-subtle text-text-muted hover:border-blue hover:bg-blue-soft-bg flex cursor-pointer flex-col items-center justify-center gap-1.75 rounded-lg border-[1.5px] border-dashed transition-all duration-150"
      style={{ width: w, height: h }}
    >
      <Icon name={icon} size={24} />
      <span className="text-body font-medium">{label}</span>
      {hint && <span className="text-caption text-text-muted">{hint}</span>}
    </span>
  );
}
