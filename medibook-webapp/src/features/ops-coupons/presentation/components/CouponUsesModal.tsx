import { isFailure } from '@/core/error/failure';
import { cn } from '@/shared/lib/cn';
import { money } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Modal } from '@/shared/ui/Modal';
import { SkeletonTable } from '@/shared/ui/Skeleton';
import { TableShell, tdClass } from '@/shared/ui/TableShell';

import { useCouponUsesQuery } from '@/features/ops-coupons/application/queries/useCouponUsesQuery';
import type { PlatformCoupon } from '@/features/ops-coupons/domain/entities/coupons.entities';

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

interface CouponUsesModalProps {
  /** The coupon to list; `null` closes the modal. */
  coupon: PlatformCoupon | null;
  onClose: () => void;
}

/**
 * Every booking that used a Medibook coupon, at any hospital, with the discount Medibook paid
 * (`GET /platform/coupons/{id}/redemptions`). An unpaid booking that was cancelled or ran out of
 * time gave its use back: those rows are struck through and not counted.
 */
export function CouponUsesModal({ coupon, onClose }: CouponUsesModalProps) {
  const query = useCouponUsesQuery(coupon?.id ?? null);
  const rows = query.data ?? [];
  const live = rows.filter((r) => r.reversedAt === null);
  const total = live.reduce((sum, r) => sum + r.discountRupees, 0);
  const hospitals = new Set(live.map((r) => r.hospitalName)).size;

  return (
    <Modal
      open={coupon !== null}
      onClose={onClose}
      title={coupon ? `${coupon.code} — uses` : ''}
      width={760}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {query.isPending ? (
        <SkeletonTable rows={4} cols={5} card={false} />
      ) : query.isError ? (
        <ErrorState
          inline
          title="Could not load the uses"
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
            Used on {live.length} booking{live.length === 1 ? '' : 's'} at {hospitals} hospital
            {hospitals === 1 ? '' : 's'} · {money(total)} paid by Medibook
            {rows.length > live.length ? ` · ${rows.length - live.length} given back` : ''}
          </div>
          <TableShell
            columns={['Booking', 'Hospital', 'Used on', 'Discount', 'Status']}
            rightCols={['Discount']}
            scrollLabel="Coupon uses"
          >
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={cn(tdClass, 'text-text-strong font-medium')}>{r.bookingRef}</td>
                <td className={tdClass}>{r.hospitalName}</td>
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
                <td className={cn(tdClass, r.reversedAt ? 'text-text-muted' : 'text-g-800')}>
                  {r.reversedAt ? `Given back ${when(r.reversedAt)}` : 'Used'}
                </td>
              </tr>
            ))}
          </TableShell>
        </>
      )}
    </Modal>
  );
}
