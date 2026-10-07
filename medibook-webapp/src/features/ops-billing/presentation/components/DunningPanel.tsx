import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { FilterSelect } from '@/shared/ui/FilterSelect';
import { Pager } from '@/shared/ui/Pager';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';

import { opsInvoiceDetailPath } from '@/app/router/paths';

import { useDunningQuery } from '@/features/ops-billing/application/queries/useDunningQuery';
import type { DunningKind } from '@/features/ops-billing/domain/entities/billing.entities';
import { BillingHospitalName } from '@/features/ops-billing/presentation/components/BillingHospitalName';
import {
  DUNNING_TIMELINE_LABELS,
  failureText,
  fmtDateTime,
  fromLabel,
} from '@/features/ops-billing/presentation/components/billingView';

const PAGE_SIZE = 10;
const KIND_ALL = 'Event: All';
const COLUMNS = ['When', 'Hospital', 'Invoice', 'Event', 'By', 'Note'] as const;

interface DunningPanelProps {
  hospitalId: string | null;
}

/**
 * The dunning timeline across hospitals (11·R2): reminders, grace, D-30
 * read-only and reinstatement, newest first, filtered on the server.
 */
export function DunningPanel({ hospitalId }: DunningPanelProps) {
  const navigate = useNavigate();
  const [kindF, setKindF] = useState(KIND_ALL);
  const [page, setPage] = useState(0);
  const kind = fromLabel<DunningKind>(DUNNING_TIMELINE_LABELS, kindF);
  const query = useDunningQuery({
    page: page + 1,
    pageSize: PAGE_SIZE,
    hospitalId,
    kinds: kind ? [kind] : [],
  });
  const rows = query.data?.items ?? [];
  const tableState: TableStateSpec | undefined = query.isPending
    ? { kind: 'loading', rows: PAGE_SIZE }
    : query.isError
      ? {
          kind: 'error',
          message: failureText(query.error, 'The dunning timeline could not be loaded.'),
          onRetry: () => void query.refetch(),
        }
      : rows.length === 0
        ? {
            kind: 'empty',
            icon: 'bell-ring',
            title: kind ? 'No events match.' : 'No dunning activity yet.',
            message: 'Reminders, grace periods and read-only changes appear here.',
          }
        : undefined;

  return (
    <>
      <div className="mb-4.5 flex flex-wrap items-center gap-3">
        <RefreshBtn
          onRefresh={async () => {
            await query.refetch();
          }}
          title="Refresh the dunning timeline"
        />
        <FilterSelect
          value={kindF}
          aria-label="Filter dunning events"
          options={[KIND_ALL, ...Object.values(DUNNING_TIMELINE_LABELS)]}
          onChange={(v) => {
            setKindF(v);
            setPage(0);
          }}
        />
      </div>
      <TableShell columns={COLUMNS} scrollLabel="Dunning timeline" state={tableState}>
        {rows.map((e) => (
          <tr key={e.id}>
            <td className={tdClass}>{fmtDateTime(e.occurredAt)}</td>
            <td className={tdClass}>
              {e.hospitalId ? <BillingHospitalName hospitalId={e.hospitalId} /> : '—'}
            </td>
            <td className={tdClass}>
              <button
                type="button"
                onClick={() => navigate(opsInvoiceDetailPath(e.invoiceId))}
                className="text-link cursor-pointer tabular-nums"
              >
                {e.invoiceNo ?? 'Open invoice'}
              </button>
            </td>
            <td className={tdClass}>{DUNNING_TIMELINE_LABELS[e.kind]}</td>
            <td className={tdClass}>{e.isAutomatic ? 'Automatic' : 'Operations'}</td>
            <td className={tdClass}>{e.note || '—'}</td>
          </tr>
        ))}
      </TableShell>
      <Pager
        total={query.data?.total ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        onPage={setPage}
        noun="events"
      />
    </>
  );
}
