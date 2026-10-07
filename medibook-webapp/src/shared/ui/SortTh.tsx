import type { SortState } from '@/shared/hooks/useSort';
import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/Icon';

interface SortThProps {
  label: string;
  /** Base header-cell classes (the prototype's `baseStyle`) — pass `thClass`. */
  baseClassName?: string;
  /** Right-align the column: text right + label/chevron row reversed. */
  right?: boolean;
  /** Column label → sort key; labels without an entry render non-clickable. */
  sortKeys?: Readonly<Record<string, string | undefined>>;
  sort?: SortState;
  onSort?: (key: string) => void;
}

/**
 * Shared sort header cell — used by table shells. A sortable column is a real
 * button inside the header (keyboard-operable) and the header reports its
 * order through `aria-sort` (UAT-76, 01·F31).
 */
export function SortTh({ label, baseClassName, right, sortKeys, sort, onSort }: SortThProps) {
  const key = sortKeys?.[label];
  const active = Boolean(sort && key && sort.key === key);
  const ariaSort =
    active && sort ? (sort.dir === 'asc' ? 'ascending' : 'descending') : key ? 'none' : undefined;
  const content = (
    <span className={cn('inline-flex items-center gap-1.25', right && 'flex-row-reverse')}>
      {label}
      {key && onSort && (
        <Icon
          name={
            active && sort
              ? sort.dir === 'asc'
                ? 'chevron-up'
                : 'chevron-down'
              : 'chevrons-up-down'
          }
          size={14}
          className={active ? 'text-text-navy' : 'text-text-faint'}
        />
      )}
    </span>
  );
  return (
    <th
      aria-sort={ariaSort}
      className={cn(
        baseClassName,
        right ? 'text-right' : 'text-left',
        'cursor-default select-none',
      )}
    >
      {key && onSort ? (
        <button type="button" onClick={() => onSort(key)} className="cursor-pointer">
          {content}
        </button>
      ) : (
        content
      )}
    </th>
  );
}
