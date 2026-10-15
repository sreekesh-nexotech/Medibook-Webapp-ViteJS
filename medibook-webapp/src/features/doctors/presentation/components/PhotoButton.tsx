import { Icon } from '@/shared/ui/Icon';

interface PhotoButtonProps {
  /** The picked image file (uploaded by the caller). */
  onPick: (file: File) => void;
  label?: string;
  /** Upload in flight: the control is inert. */
  disabled?: boolean;
}

/**
 * Upload / change-photo control backed by a visually hidden file input
 * (design `PhotoButton`). The input stays focusable, so Tab reaches it and
 * Space opens the picker; the visible pill shows its focus ring.
 */
export function PhotoButton({
  onPick,
  label = 'Change Photo',
  disabled = false,
}: PhotoButtonProps) {
  return (
    <label className="inline-block">
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="peer sr-only"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = '';
        }}
      />
      <span className="text-body border-text-navy text-text-navy peer-focus-visible:outline-blue inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-3.5 py-2 font-medium peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2">
        <Icon name="upload" size={16} /> {label}
      </span>
    </label>
  );
}
