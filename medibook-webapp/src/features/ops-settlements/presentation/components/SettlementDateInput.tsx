interface SettlementDateInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Tooltip **and** accessible name — this control has no visible label. */
  title: string;
}

/**
 * Native date input styled like the design's expected-date range filters.
 *
 * The value is the input's own `yyyy-mm-dd` string, compared as a string
 * against the equally ISO `expected` field — deliberately no `Date` round
 * trip, because `new Date(value).toISOString()` on a local midnight shifts the
 * day backwards in every timezone behind UTC (the hospital app's
 * yesterday-date defect).
 */
export function SettlementDateInput({ value, onChange, title }: SettlementDateInputProps) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      title={title}
      aria-label={title}
      className="border-border rounded-input text-body text-text-body h-11 border bg-white px-3"
    />
  );
}
