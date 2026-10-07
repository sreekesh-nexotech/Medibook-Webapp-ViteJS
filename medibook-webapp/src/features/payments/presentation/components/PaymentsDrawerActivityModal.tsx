import { isFailure } from '@/core/error/failure';

import { cn } from '@/shared/lib/cn';
import { fmtDate, money } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Modal } from '@/shared/ui/Modal';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SkeletonCards } from '@/shared/ui/Skeleton';
import { TableShell, tdClass } from '@/shared/ui/TableShell';

import { useCashSessionActivityQuery } from '@/features/payments/application/queries/useCashSessionActivityQuery';
import {
  REFUND_STATUS_BADGE,
  clockCopy,
} from '@/features/payments/presentation/components/payments.view';

/** The drawer whose cash movements to list. */
export interface DrawerActivityTarget {
  readonly id: string;
  readonly businessDate: string;
  readonly staffName: string;
  readonly counterCode: string | null;
}

interface PaymentsDrawerActivityModalProps {
  drawer: DrawerActivityTarget;
  onClose: () => void;
}

const PAYMENT_COLUMNS = ['Time', 'Patient', 'Booking', 'Amount'] as const;
const REFUND_COLUMNS = ['Time', 'Booking', 'Status', 'Amount'] as const;

/**
 * The cash payments taken into one drawer and the cash refunds handed back
 * from it (UAT-72, appendix 04 F23/R11) — what an admin checks a variance
 * against before reconciling.
 */
export function PaymentsDrawerActivityModal({ drawer, onClose }: PaymentsDrawerActivityModalProps) {
  const activity = useCashSessionActivityQuery(drawer);
  const data = activity.data;
  const cashIn = (data?.payments ?? []).reduce((s, p) => s + p.amountRupees, 0);
  const cashOut = (data?.refunds ?? [])
    .filter((r) => r.status !== 'failed' && r.status !== 'superseded')
    .reduce((s, r) => s + r.amountRupees, 0);

  return (
    <Modal
      open
      onClose={onClose}
      title={`${drawer.staffName}’s drawer`}
      width={640}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="text-caption text-text-muted mb-3.5">
        {fmtDate(drawer.businessDate)}
        {drawer.counterCode ? ` · Counter ${drawer.counterCode}` : ''} · cash only
      </div>
      {activity.isPending ? (
        <SkeletonCards count={1} lines={4} />
      ) : activity.isError || !data ? (
        <ErrorState
          inline
          title="The drawer’s payments didn’t load"
          message={isFailure(activity.error) ? activity.error.message : undefined}
          onRetry={() => void activity.refetch()}
        />
      ) : (
        <div className="flex flex-col gap-5">
          <section>
            <div className="mb-2 flex items-center gap-2">
              <SectionTitle size={15}>Cash taken</SectionTitle>
              <span className="flex-1" />
              <span className="text-body text-g-700 font-semibold tabular-nums">
                {money(cashIn)}
              </span>
            </div>
            <TableShell
              columns={PAYMENT_COLUMNS}
              rightCols={['Amount']}
              scrollLabel="Cash taken into this drawer"
              state={
                data.payments.length === 0
                  ? {
                      kind: 'empty',
                      icon: 'banknote',
                      title: 'No cash was taken into this drawer.',
                    }
                  : undefined
              }
            >
              {data.payments.map((p) => (
                <tr key={p.id}>
                  <td className={cn(tdClass, 'tabular-nums')}>{clockCopy(p.capturedAt)}</td>
                  <td className={tdClass}>
                    {p.patient?.fullName ?? '—'}
                    <div className="text-caption text-text-muted">{p.patient?.mrn ?? ''}</div>
                  </td>
                  <td className={tdClass}>{p.bookingRefs.join(', ') || '—'}</td>
                  <td className={cn(tdClass, 'text-right font-semibold tabular-nums')}>
                    {money(p.amountRupees)}
                  </td>
                </tr>
              ))}
            </TableShell>
          </section>
          <section>
            <div className="mb-2 flex items-center gap-2">
              <SectionTitle size={15}>Cash refunded</SectionTitle>
              <span className="flex-1" />
              <span className="text-body text-d-700 font-semibold tabular-nums">
                {cashOut > 0 ? `−${money(cashOut)}` : money(0)}
              </span>
            </div>
            <TableShell
              columns={REFUND_COLUMNS}
              rightCols={['Amount']}
              scrollLabel="Cash refunded from this drawer"
              state={
                data.refunds.length === 0
                  ? {
                      kind: 'empty',
                      icon: 'undo-2',
                      title: 'No cash was refunded from this drawer.',
                    }
                  : undefined
              }
            >
              {data.refunds.map((r) => (
                <tr key={r.id}>
                  <td className={cn(tdClass, 'tabular-nums')}>{clockCopy(r.requestedAt)}</td>
                  <td className={tdClass}>{r.bookingRef ?? '—'}</td>
                  <td className={tdClass}>{REFUND_STATUS_BADGE[r.status].label}</td>
                  <td className={cn(tdClass, 'text-right font-semibold tabular-nums')}>
                    −{money(r.amountRupees)}
                  </td>
                </tr>
              ))}
            </TableShell>
          </section>
        </div>
      )}
    </Modal>
  );
}
