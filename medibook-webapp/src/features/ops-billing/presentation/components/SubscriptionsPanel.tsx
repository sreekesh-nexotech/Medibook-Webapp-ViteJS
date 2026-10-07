import { useState } from 'react';

import { fmtDate } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { IconBtn } from '@/shared/ui/IconBtn';
import { OpsEntity } from '@/shared/ui/OpsEntity';
import { Pager } from '@/shared/ui/Pager';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';

import { useSubscriptionsQuery } from '@/features/ops-billing/application/queries/useSubscriptionsQuery';
import type {
  BillingSubscription,
  SubscriptionStatus,
} from '@/features/ops-billing/domain/entities/billing.entities';
import {
  SUBSCRIPTION_STATUS_BADGES,
  dateOf,
  failureText,
  fromLabel,
  subscriptionBadge,
} from '@/features/ops-billing/presentation/components/billingView';
import { SubscriptionDrawer } from '@/features/ops-billing/presentation/components/SubscriptionDrawer';

const PAGE_SIZE = 8;
const STATUS_ALL = 'Status: All';
const COLUMNS = ['Hospital', 'Plan', 'Status', 'Next invoice', 'Grace', 'Action'] as const;

interface SubscriptionsPanelProps {
  /** One hospital's subscriptions only (from `?hospital=`). */
  hospitalId: string | null;
}

/**
 * Every hospital's subscription (11·R1): status incl. trial, grace and D-30
 * read-only, next invoice and grace override, filtered on the server; a row
 * opens the drawer with plan change and grace override.
 */
export function SubscriptionsPanel({ hospitalId }: SubscriptionsPanelProps) {
  const [statusF, setStatusF] = useState(STATUS_ALL);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<BillingSubscription | null>(null);
  const status = fromLabel<SubscriptionStatus>(SUBSCRIPTION_STATUS_BADGES, statusF);
  const query = useSubscriptionsQuery({
    page: page + 1,
    pageSize: PAGE_SIZE,
    statuses: status ? [status] : [],
    hospitalId,
    planId: null,
    billingPeriod: null,
  });
  const rows = query.data?.items ?? [];
  const tableState: TableStateSpec | undefined = query.isPending
    ? { kind: 'loading', rows: PAGE_SIZE }
    : query.isError
      ? {
          kind: 'error',
          message: failureText(query.error, 'The subscriptions could not be loaded.'),
          onRetry: () => void query.refetch(),
        }
      : rows.length === 0
        ? {
            kind: 'empty',
            icon: 'layers',
            title: status ? 'No subscriptions match.' : 'No subscriptions yet.',
            message: status
              ? 'Try another status.'
              : 'A subscription starts when a hospital is onboarded on a plan.',
          }
        : undefined;

  return (
    <>
      <div className="mb-4.5 flex flex-wrap items-center gap-3">
        <RefreshBtn
          onRefresh={async () => {
            await query.refetch();
          }}
          title="Refresh subscriptions"
        />
        <FilterSelect
          value={statusF}
          aria-label="Filter subscriptions by status"
          options={[STATUS_ALL, ...Object.values(SUBSCRIPTION_STATUS_BADGES).map((b) => b.label)]}
          onChange={(v) => {
            setStatusF(v);
            setPage(0);
          }}
        />
      </div>
      <TableShell columns={COLUMNS} scrollLabel="Subscriptions" state={tableState}>
        {rows.map((s) => {
          const badge = subscriptionBadge(s.status);
          return (
            <tr
              key={s.id}
              onClick={() => setOpen(s)}
              className="hover:bg-grey-200 cursor-pointer transition-colors duration-150"
            >
              <td className={tdClass}>
                <OpsEntity
                  icon="building-2"
                  tint="primary"
                  title={s.hospitalName ?? 'Hospital'}
                  sub={`Billed ${s.billingPeriod}`}
                />
              </td>
              <td className={tdClass}>{s.planName}</td>
              <td className={tdClass}>
                <Badge status={badge.status}>{badge.label}</Badge>
              </td>
              <td className={tdClass}>
                {s.nextInvoiceAt ? fmtDate(dateOf(s.nextInvoiceAt)) : '—'}
              </td>
              <td className={tdClass}>
                {s.graceDaysOverride === null ? 'Default' : `${s.graceDaysOverride} days`}
              </td>
              <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                <IconBtn
                  name="eye"
                  label="Open subscription"
                  box={36}
                  size={16}
                  onClick={() => setOpen(s)}
                />
              </td>
            </tr>
          );
        })}
      </TableShell>
      <Pager
        total={query.data?.total ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        onPage={setPage}
        noun="subscriptions"
      />
      {open && (
        <SubscriptionDrawer
          key={open.id}
          subscription={rows.find((r) => r.id === open.id) ?? open}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
