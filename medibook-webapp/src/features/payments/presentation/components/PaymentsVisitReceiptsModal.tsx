import { isFailure } from '@/core/error/failure';

import { fmtDate, money } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Modal } from '@/shared/ui/Modal';
import { SkeletonCards } from '@/shared/ui/Skeleton';

import { useVisitReceiptsQuery } from '@/features/payments/application/queries/useVisitReceiptsQuery';

interface PaymentsVisitReceiptsModalProps {
  /** The desk visit whose receipts to list; `null` = closed. */
  visitId: string | null;
  /** Booking refs of the visit's consultations, for the subtitle. */
  bookingRefs: readonly string[];
  onClose: () => void;
  /** Open one consultation's receipt in the appointments receipt view. */
  onOpenReceipt: (appointmentId: string) => void;
}

/**
 * The receipts of one desk visit (H9). A visit is paid as one payment line
 * but the backend issues one tax receipt per consultation, so this lists them
 * and each opens in the appointments feature's receipt view.
 */
export function PaymentsVisitReceiptsModal({
  visitId,
  bookingRefs,
  onClose,
  onOpenReceipt,
}: PaymentsVisitReceiptsModalProps) {
  const receipts = useVisitReceiptsQuery(visitId);

  return (
    <Modal
      open={visitId !== null}
      onClose={onClose}
      title="Visit receipts"
      width={520}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="text-caption text-text-muted mb-3.5">
        One payment for {bookingRefs.length} consultation{bookingRefs.length === 1 ? '' : 's'}
        {bookingRefs.length > 0 ? ` (${bookingRefs.join(', ')})` : ''} — one receipt each.
      </div>
      {receipts.isPending ? (
        <SkeletonCards count={1} lines={3} />
      ) : receipts.isError ? (
        <ErrorState
          inline
          title="The receipts didn't load"
          message={isFailure(receipts.error) ? receipts.error.message : undefined}
          onRetry={() => void receipts.refetch()}
        />
      ) : receipts.data.length === 0 ? (
        <EmptyState
          icon="receipt"
          title="No receipts issued yet."
          message="Receipts are issued when the visit's payment is recorded."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {receipts.data.map((r) => (
            <div
              key={r.id}
              className="border-border-soft flex items-center gap-3 rounded-md border px-3.5 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="text-body text-text-strong font-medium">{r.receiptNo}</div>
                <div className="text-caption text-text-muted">
                  {fmtDate(r.issuedAt.slice(0, 10))} · {money(r.totalRupees)}
                </div>
              </div>
              {r.appointmentId && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon="receipt"
                  onClick={() => r.appointmentId && onOpenReceipt(r.appointmentId)}
                >
                  View
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
