import { useNavigate } from 'react-router-dom';

import { fmtDate, money } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Card } from '@/shared/ui/Card';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';

import { opsPath } from '@/app/router/paths';

import { useSettlementPeriodsQuery } from '@/features/ops-settlements/application/queries/useSettlementPeriodsQuery';
import type {
  PeriodFilter,
  SettlementPeriodStatus,
} from '@/features/ops-settlements/domain/entities/opsSettlements.entities';

/** Periods shown, newest first; Hospital Settlements has the full queue. */
const RECENT_ROWS = 6;

const COLUMNS = ['Period', 'Gross', 'Commission', 'Net Payable', 'Status'] as const;

/** [badge status, label] per period status. */
const PERIOD_STATUS_VIEW: Readonly<Record<SettlementPeriodStatus, readonly [string, string]>> = {
  open: ['Pending', 'Accruing'],
  closed: ['Pending', 'Payable'],
  paid: ['Paid', 'Paid out'],
  on_hold: ['Overdue', 'On hold'],
};

interface OpsSettlementsHospitalCardProps {
  hospitalId: string;
}

/** One hospital's latest settlement periods, for its ops profile. */
export function OpsSettlementsHospitalCard({ hospitalId }: OpsSettlementsHospitalCardProps) {
  const navigate = useNavigate();
  const filter: PeriodFilter = {
    statuses: ['open', 'closed', 'paid', 'on_hold'],
    dateFrom: null,
    dateTo: null,
    hospitalId,
  };
  const periods = useSettlementPeriodsQuery(filter);
  const rows = [...(periods.data ?? [])]
    .sort((a, b) => b.periodStart.localeCompare(a.periodStart))
    .slice(0, RECENT_ROWS);

  let state: TableStateSpec | undefined;
  if (periods.isPending) state = { kind: 'loading', rows: 3 };
  else if (periods.isLoadingError)
    state = { kind: 'error', error: periods.error, onRetry: () => void periods.refetch() };
  else if (rows.length === 0)
    state = { kind: 'empty', icon: 'banknote', title: 'No settlement periods yet.' };

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <SectionTitle>Settlements</SectionTitle>
        <button
          type="button"
          onClick={() => navigate(opsPath('settlements'))}
          className="text-body text-blue cursor-pointer border-none bg-transparent p-0"
        >
          Open hospital settlements
        </button>
      </div>
      <TableShell columns={COLUMNS} scrollLabel="This hospital's settlements" state={state}>
        {rows.map((p) => {
          const [badge, label] = PERIOD_STATUS_VIEW[p.status];
          return (
            <tr key={p.id}>
              <td className={tdClass}>
                {fmtDate(p.periodStart)} – {fmtDate(p.periodEnd)}
              </td>
              <td className={`${tdClass} tabular-nums`}>{money(p.grossRupees)}</td>
              <td className={`${tdClass} tabular-nums`}>{money(p.commissionRupees)}</td>
              <td className={`${tdClass} tabular-nums`}>{money(p.netPayableRupees)}</td>
              <td className={tdClass}>
                <Badge status={badge}>{label}</Badge>
              </td>
            </tr>
          );
        })}
      </TableShell>
    </Card>
  );
}
