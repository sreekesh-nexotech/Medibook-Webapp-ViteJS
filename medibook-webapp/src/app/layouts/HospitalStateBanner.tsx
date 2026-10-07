import { cn } from '@/shared/lib/cn';
import type { HospitalWriteBlock } from '@/shared/hooks/usePermission';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';

interface HospitalStateBannerProps {
  /** Why writes are refused; nothing renders when `null`. */
  block: HospitalWriteBlock;
  /** Opens Plan & Billing, for roles that may see the invoice (read-only only). */
  onOpenBilling?: () => void;
}

/** One line per state: what happened, what still works, how it ends. */
const COPY: Readonly<Record<Exclude<HospitalWriteBlock, null>, { title: string; body: string }>> = {
  read_only: {
    title: 'This hospital is read-only',
    body: "The Medibook subscription is overdue. You can view everything, but changes can't be saved and the hospital is hidden from the patient app until the invoice is paid.",
  },
  suspended: {
    title: 'This hospital is suspended',
    body: "Medibook operations has suspended this hospital. You can view everything, but changes can't be saved. Contact support@medibook.in to reactivate it.",
  },
};

/**
 * Shell banner for a hospital that refuses every write (UAT-38): a lapsed
 * subscription (D-30) or a suspension (decision 9). Write controls are
 * already hidden or disabled by `usePermission`; this says why.
 */
export function HospitalStateBanner({ block, onOpenBilling }: HospitalStateBannerProps) {
  if (block === null) return null;
  const copy = COPY[block];
  return (
    <div
      role="status"
      className={cn(
        'flex flex-none flex-wrap items-center gap-3 border-b px-4 py-2.5 lg:px-7',
        block === 'suspended'
          ? 'bg-d-100 text-d-500 border-d-100'
          : 'bg-y-100 text-y-800 border-y-100',
      )}
    >
      <Icon name={block === 'suspended' ? 'ban' : 'lock'} size={18} />
      <div className="text-caption min-w-0 flex-1">
        <span className="font-semibold">{copy.title}.</span> {copy.body}
      </div>
      {block === 'read_only' && onOpenBilling && (
        <Button size="sm" variant="secondary" icon="receipt" onClick={onOpenBilling}>
          Open Plan &amp; Billing
        </Button>
      )}
    </div>
  );
}
