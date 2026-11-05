import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { useCancelPlatformUserBookingsMutation } from '@/features/ops-platform-users/application/queries/useCancelPlatformUserBookingsMutation';
import { usePlatformUserCancelPreviewQuery } from '@/features/ops-platform-users/application/queries/usePlatformUserCancelPreviewQuery';
import {
  formatDateTime,
  upcomingPaidCountLabel,
  upcomingPaidMoreLabel,
} from '@/features/ops-platform-users/presentation/components/platformUsersFormat';
import { moneyFromPaise } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ErrorState } from '@/shared/ui/ErrorState';
import { OpsConfirm } from '@/shared/ui/OpsConfirm';
import { Spinner } from '@/shared/ui/Spinner';
import { toast } from '@/shared/ui/toast/toast.store';

interface BlockedBookingsCardProps {
  readonly userId: string;
  readonly name: string;
  /** `platform_users.edit` — the preview needs only view, cancelling needs edit. */
  readonly mayEdit: boolean;
  /** What the block response itself reported, shown while the preview loads. */
  readonly reported: { readonly refs: readonly string[]; readonly total: number | null };
}

/**
 * A blocked patient cannot sign in to cancel their paid upcoming bookings (UAT T10), so ops
 * sees them here with what each refunds, and can cancel them all. The list is a dry run;
 * nothing is cancelled until the explicit confirm, which sends one Idempotency-Key.
 */
export function BlockedBookingsCard({ userId, name, mayEdit, reported }: BlockedBookingsCardProps) {
  const preview = usePlatformUserCancelPreviewQuery(userId, true);
  const cancel = useCancelPlatformUserBookingsMutation();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  if (preview.isPending) {
    return (
      <Card pad={16} data-testid="blocked-bookings-loading">
        <div className="text-body text-text-muted flex items-center gap-2.5">
          <Spinner size={18} label="Checking upcoming paid bookings" />
          {reported.refs.length > 0
            ? `${upcomingPaidCountLabel(reported.refs, reported.total)} — loading the refund amounts…`
            : 'Checking upcoming paid bookings…'}
        </div>
      </Card>
    );
  }
  if (preview.isError) {
    return (
      <Card pad={16}>
        <ErrorState
          inline
          error={preview.error}
          title="Could not check upcoming paid bookings"
          message={
            isFailure(preview.error) ? preview.error.message : 'Please try again in a moment.'
          }
          onRetry={() => void preview.refetch()}
        />
      </Card>
    );
  }

  const { bookings, totalRefundPaise } = preview.data;
  if (bookings.length === 0) return null;
  const n = bookings.length;
  const refs = bookings.map((b) => b.bookingRef);
  const countLabel = upcomingPaidCountLabel(refs, reported.total);
  const moreLabel = upcomingPaidMoreLabel(refs, reported.total);

  const handleConfirm = (): void => {
    cancel.mutate(userId, {
      onSuccess: (result) => {
        const done = result.cancelledBookingRefs.length;
        toast(`${done} booking${done === 1 ? '' : 's'} cancelled and refunded.`);
        setIsConfirmOpen(false);
      },
      onError: (failure) =>
        toast(
          isFailure(failure) ? failure.message : 'Could not cancel these bookings.',
          'error',
          failure,
        ),
    });
  };

  return (
    <Card pad={16} data-testid="blocked-upcoming-bookings">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-body text-text-strong font-medium">{countLabel}</div>
          <div className="text-body text-text-body">
            {name} can no longer sign in to cancel these for a refund. Cancelling them refunds{' '}
            <span className="text-text-strong font-medium">{moneyFromPaise(totalRefundPaise)}</span>{' '}
            in full, including the convenience fee.
          </div>
        </div>
        {mayEdit && (
          <Button variant="danger" onClick={() => setIsConfirmOpen(true)}>
            {`Cancel and refund ${n} booking${n === 1 ? '' : 's'}`}
          </Button>
        )}
      </div>
      <ul className="divide-border-soft border-border-soft mt-3 divide-y rounded-md border">
        {bookings.map((b) => (
          <li key={b.bookingRef} className="flex flex-wrap items-center gap-x-3 px-3.5 py-2.5">
            <span className="text-body text-text-strong font-medium">{b.bookingRef}</span>
            <span className="text-caption text-text-muted flex-1">
              {b.hospitalName} · {formatDateTime(b.scheduledStartAt)}
            </span>
            <span className="text-body text-text-body">{moneyFromPaise(b.refundPaise)}</span>
          </li>
        ))}
      </ul>
      {moreLabel && <div className="text-caption text-text-muted mt-2">{moreLabel}</div>}
      <OpsConfirm
        open={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        icon="ban"
        tone="danger"
        title={`Cancel and refund ${n} booking${n === 1 ? '' : 's'}?`}
        body={`Each booking is cancelled by the hospital and ${name} is refunded in full, including the convenience fee, and told. This cannot be undone.`}
        summary={[
          { k: 'Bookings', v: String(n), num: true },
          { k: 'Total refund', v: moneyFromPaise(totalRefundPaise), num: true },
        ]}
        confirmLabel={cancel.isPending ? 'Cancelling…' : 'Cancel and refund'}
        confirmVariant="danger"
        busy={cancel.isPending}
        onConfirm={handleConfirm}
      />
    </Card>
  );
}
