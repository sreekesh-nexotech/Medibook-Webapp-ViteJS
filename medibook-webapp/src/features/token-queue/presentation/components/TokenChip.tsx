import { cn } from '@/shared/lib/cn';

interface TokenChipProps {
  label: string;
  patientName: string | null;
  /** Calls this token; absent when the desk cannot call it now. */
  onCall?: () => void;
  /** Skipped tokens read quieter than the live queue. */
  muted?: boolean;
}

/** One queued token: a plain chip, or a button that calls it when the desk is free. */
export function TokenChip({ label, patientName, onCall, muted = false }: TokenChipProps) {
  const chip = cn(
    'text-caption rounded-full px-2.25 py-0.5 font-semibold',
    muted ? 'bg-grey-200 text-text-muted' : 'text-blue bg-blue-soft-bg',
  );
  if (!onCall) {
    return (
      <span title={patientName ?? undefined} className={chip}>
        {label}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onCall}
      title={`Call ${label}${patientName ? ` — ${patientName}` : ''}`}
      aria-label={`Call token ${label}`}
      className={cn(chip, 'cursor-pointer hover:opacity-80')}
    >
      {label}
    </button>
  );
}
