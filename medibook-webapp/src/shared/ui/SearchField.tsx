import { Icon } from '@/shared/ui/Icon';
import { useFieldContext } from '@/shared/ui/field-context';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Overrides the id inherited from the enclosing `Field` / `OpsField`. */
  id?: string;
  /** Form control name. */
  name?: string;
  /**
   * Accessible name. A search bar rarely has a visible label, so this is what
   * a screen reader announces (audit 3.3.4). Defaults to the placeholder, then
   * to "Search".
   */
  'aria-label'?: string;
}

/** Full-width search bar used at the top of list screens. */
export function SearchField({
  value,
  onChange,
  placeholder,
  id,
  name,
  'aria-label': ariaLabel,
}: SearchFieldProps) {
  const field = useFieldContext();
  return (
    <div className="border-border text-text-muted flex h-12 w-full items-center gap-3 rounded-lg border bg-white px-4.5">
      <Icon name="search" size={20} />
      <input
        id={id ?? field?.id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder ?? 'Search'}
        aria-describedby={field?.describedById}
        className="text-body-lg text-text-strong flex-1 border-none bg-transparent outline-none"
      />
    </div>
  );
}
