import { StatCard, type StatCardData } from '@/shared/ui/StatCard';

interface KpiStripProps<T extends StatCardData> {
  items: readonly T[];
  /** Per-tile click (the prototype's `onClick={() => onNavigate(k.go)}`). */
  onItem?: (item: T, index: number) => void;
}

/**
 * The dashboards' KPI row — `<div style={{ display: 'flex', gap: 16 }}>` of
 * StatCard tiles. Generic so screens can carry extra fields (e.g. `go`) on
 * their KPI items and read them back in `onItem`.
 */
export function KpiStrip<T extends StatCardData>({ items, onItem }: KpiStripProps<T>) {
  return (
    <div className="flex flex-wrap gap-4">
      {items.map((k, i) => (
        <StatCard key={k.label} k={k} onClick={onItem ? () => onItem(k, i) : undefined} />
      ))}
    </div>
  );
}
