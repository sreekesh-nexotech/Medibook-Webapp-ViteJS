import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { DEFAULT_PAGE_SIZE } from '@/core/api/pagination';
import { isFailure } from '@/core/error/failure';
import { fmtDate } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Drawer } from '@/shared/ui/Drawer';
import { IconBtn } from '@/shared/ui/IconBtn';
import { Pager } from '@/shared/ui/Pager';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';

import { opsHospitalDetailPath } from '@/app/router/paths';

import {
  dateOf,
  subscriptionBadge,
} from '@/features/ops-billing/presentation/components/billingView';
import { usePlanSubscribersQuery } from '@/features/ops-plans/application/queries/usePlanSubscribersQuery';
import type { CatalogPlan } from '@/features/ops-plans/domain/entities/plans.catalog';

const COLUMNS = ['Hospital', 'Status', 'Billed', 'Since', 'Next invoice', ''] as const;
const LOADING_ROWS = 4;

function dateCopy(iso: string | null): string {
  return iso ? fmtDate(dateOf(iso)) : '—';
}

interface PlanSubscribersDrawerProps {
  plan: CatalogPlan;
  onClose: () => void;
}

/**
 * The hospitals on a plan now (11·R9, `GET /platform/plans/{id}/subscribers`,
 * `plans.view`): live subscriptions only, newest first, each opening the
 * hospital's page.
 */
export function PlanSubscribersDrawer({ plan, onClose }: PlanSubscribersDrawerProps) {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const query = usePlanSubscribersQuery(plan.id, page + 1);
  const rows = query.data?.items ?? [];
  const total = query.data?.total ?? 0;

  const state: TableStateSpec | undefined = query.isPending
    ? { kind: 'loading', rows: LOADING_ROWS }
    : query.isError
      ? {
          kind: 'error',
          message: isFailure(query.error)
            ? query.error.message
            : 'The hospitals on this plan could not be loaded.',
          onRetry: () => void query.refetch(),
        }
      : rows.length === 0
        ? {
            kind: 'empty',
            icon: 'building-2',
            title: 'No hospitals on this plan.',
            message: plan.isActive
              ? 'A hospital joins it when it is onboarded on it or moves to it.'
              : 'The plan is archived, so no hospital can join it.',
          }
        : undefined;

  const open = (hospitalId: string) => navigate(opsHospitalDetailPath(hospitalId));

  return (
    <Drawer
      open
      onClose={onClose}
      title={`Hospitals on ${plan.name}`}
      subtitle={query.data ? `${total} on this plan now` : 'Live subscriptions'}
      width={720}
    >
      <TableShell columns={COLUMNS} scrollLabel={`Hospitals on ${plan.name}`} state={state}>
        {rows.map((s) => {
          const badge = subscriptionBadge(s.status);
          return (
            <tr
              key={s.id}
              onClick={() => open(s.hospitalId)}
              className="hover:bg-grey-200 cursor-pointer transition-colors duration-150"
            >
              <td className={tdClass}>{s.hospitalName}</td>
              <td className={tdClass}>
                <Badge status={badge.status}>{badge.label}</Badge>
              </td>
              <td className={tdClass}>{s.billingPeriod}</td>
              <td className={tdClass}>{dateCopy(s.startedAt)}</td>
              <td className={tdClass}>{dateCopy(s.nextInvoiceAt)}</td>
              <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                <IconBtn
                  name="eye"
                  label={`Open ${s.hospitalName}`}
                  box={36}
                  size={16}
                  onClick={() => open(s.hospitalId)}
                />
              </td>
            </tr>
          );
        })}
      </TableShell>
      {total > DEFAULT_PAGE_SIZE && (
        <Pager
          total={total}
          page={page}
          pageSize={DEFAULT_PAGE_SIZE}
          onPage={setPage}
          noun="hospitals"
        />
      )}
    </Drawer>
  );
}
