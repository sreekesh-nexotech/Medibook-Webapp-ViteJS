import { isFailure } from '@/core/error/failure';
import { cn } from '@/shared/lib/cn';
import { money } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Modal } from '@/shared/ui/Modal';
import { SkeletonTable } from '@/shared/ui/Skeleton';
import { TableShell, tdClass } from '@/shared/ui/TableShell';

import { useCouponRedemptionsQuery } from '@/features/settings/application/queries/services.queries';
import type { HospitalCoupon } from '@/features/settings/domain/entities/services.entities';

const DATE_TIME: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', DATE_TIME);
}

interface CouponRedemptionsModalProps {
  /** The coupon to list; `null` closes the modal. */
  coupon: HospitalCoupon | null;
  onClose: () => void;
}

/**
 * Every booking a coupon was used on (`GET /coupons/{id}/redemptions`). A
 * cancelled booking gives its use back — those rows are shown as reversed
 * and are not counted in the coupon's usage.
 */
export function CouponRedemptionsModal({ coupon, onClose }: CouponRedemptionsModalProps) {
  const query = useCouponRedemptionsQuery(coupon?.id ?? null);
  const rows = query.data ?? [];
  const live = rows.filter((r) => r.reversedAt === null);
  const total = live.reduce((sum, r) => sum + r.discountRupees, 0);

  return (
    <Modal
      open={coupon !== null}
      onClose={onClose}
      title={coupon ? `${coupon.code} — redemptions` : ''}
      width={640}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {query.isPending ? (
        <SkeletonTable rows={4} cols={4} card={false} />
      ) : query.isError ? (
        <ErrorState
          inline
          title="Could not load the redemptions"
          message={isFailure(query.error) ? query.error.message : 'Please try again.'}
          onRetry={() => void query.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          compact
          icon="ticket"
          title="Not used yet"
          message="Bookings that use this code appear here."
        />
      ) : (
        <>
          <div className="text-body text-text-body mb-3">
            Used on {live.length} booking{live.length === 1 ? '' : 's'} · {money(total)} in
            discounts
            {rows.length > live.length
              ? ` · ${rows.length - live.length} given back by cancellation`
              : ''}
          </div>
          <TableShell
            columns={['Booking', 'Used on', 'Discount', 'Status']}
            rightCols={['Discount']}
            scrollLabel="Coupon redemptions"
          >
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={cn(tdClass, 'text-text-strong font-medium')}>{r.bookingRef}</td>
                <td className={tdClass}>{when(r.redeemedAt)}</td>
                <td
                  className={cn(
                    tdClass,
                    'text-right tabular-nums',
                    r.reversedAt && 'text-text-muted line-through',
                  )}
                >
                  {money(r.discountRupees)}
                </td>
                <td className={cn(tdClass, r.reversedAt ? 'text-text-muted' : 'text-g-700')}>
                  {r.reversedAt ? `Given back ${when(r.reversedAt)}` : 'Applied'}
                </td>
              </tr>
            ))}
          </TableShell>
        </>
      )}
    </Modal>
  );
}
