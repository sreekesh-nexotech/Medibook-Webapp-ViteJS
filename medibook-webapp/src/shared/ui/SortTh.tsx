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
 * Shared sort header cell — used by table shells. A sortable column holds a
 * real button and says how it is sorted (`aria-sort`), so it works from the
 * keyboard and a screen reader hears the order (A11Y-01).
 */
export function SortTh({ label, baseClassName, right, sortKeys, sort, onSort }: SortThProps) {
  const key = sortKeys?.[label];
  const active = Boolean(sort && key && sort.key === key);
  const ariaSort = active && sort ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined;
  if (!key || !onSort) {
    return (
      <th className={cn(baseClassName, right ? 'text-right' : 'text-left', 'select-none')}>
        {label}
      </th>
    );
  }
  return (
    <th
      aria-sort={ariaSort}
      className={cn(baseClassName, right ? 'text-right' : 'text-left', 'select-none')}
    >
      <button
        type="button"
        onClick={() => onSort(key)}
        className={cn(
          'inline-flex cursor-pointer items-center gap-1.25',
          right && 'flex-row-reverse',
        )}
      >
        {label}
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
      </button>
    </th>
  );
}
