import { Icon } from '@/shared/ui/Icon';

interface PhotoButtonProps {
  /** The picked image file (uploaded by the caller). */
  onPick: (file: File) => void;
  label?: string;
  /** Upload in flight: the control is inert. */
  disabled?: boolean;
}

/** Upload / change-photo control backed by a hidden file input (design `PhotoButton`). */
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
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = '';
        }}
      />
      <span className="text-body border-text-navy text-text-navy inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-3.5 py-2 font-medium">
        <Icon name="upload" size={16} /> {label}
      </span>
    </label>
  );
}
