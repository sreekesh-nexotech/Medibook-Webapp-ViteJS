import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';

import { useSort, type SortAccessors } from '@/shared/hooks/useSort';
import { cn } from '@/shared/lib/cn';
import { downloadCsv, type CsvCell } from '@/shared/lib/download';
import { money } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Can } from '@/shared/ui/Can';
import { Card } from '@/shared/ui/Card';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { InfoDot } from '@/shared/ui/InfoDot';
import { KpiStrip } from '@/shared/ui/KpiStrip';
import { Pager } from '@/shared/ui/Pager';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SearchField } from '@/shared/ui/SearchField';
import type { StatCardData } from '@/shared/ui/StatCard';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { Tabs } from '@/shared/ui/Tabs';
import { toast } from '@/shared/ui/toast/toast.store';

import {
  formatUpdatedAt,
  useListRefresh,
} from '@/features/appointments/application/queries/useListRefresh';
import { useAppointmentsStore } from '@/features/appointments/application/store/appointments.store';
import {
  GST_LABEL,
  HOSPITAL_GSTIN,
  grossAmount,
  taxBreakdown,
} from '@/features/appointments/application/store/appointments.logic';
import { type Appointment } from '@/features/appointments/application/store/appointments.types';
import {
  useCatalogDepartments,
  useCatalogDoctorNames,
} from '@/features/doctors/application/store/catalog.selectors';
import { MarkPaymentModal } from '@/features/appointments/presentation/components/MarkPaymentModal';
import { ReceiptModal } from '@/features/appointments/presentation/components/ReceiptModal';
import { RefundModal } from '@/features/appointments/presentation/components/RefundModal';

/** Payment tabs (design `["All", "Paid", "Pending", "Refunded"]` + the waiver state). */
type PayTab = 'All' | 'Paid' | 'Pending' | 'Refunded' | 'Waived';

const PAY_TABS: readonly PayTab[] = ['All', 'Paid', 'Pending', 'Refunded', 'Waived'];

/** Records shown per page (design `PAY_PAGE`). */
const PAY_PAGE = 9;

const COLUMNS = ['Patient', 'Doctor / Dept', 'Source', 'Mode', 'Amount', 'Status', 'Action'];

/**
 * Payments — record external walk-in payments + view prepaid online bookings
 * (design `Payments`, `Billing.jsx`). Ported 1:1 onto the appointments store,
 * reusing the appointments feature's Mark Payment + Receipt + Refund modals.
 *
 * Every rupee figure on this screen is GST-inclusive, so the KPIs, the table
 * and the printed receipts agree (HA-10).
 */
export function PaymentsScreen() {
  const { role } = useParams();
  const appts = useAppointmentsStore((s) => s.appts);
  const ensureReceiptNo = useAppointmentsStore((s) => s.ensureReceiptNo);
  // Department and doctor filters follow the hospital's own catalogue, so a
  // doctor added through Doctors & Departments is filterable here (audit 2.6.3).
  const departments = useCatalogDepartments();
  const doctorNames = useCatalogDoctorNames();

  const [tab, setTab] = useState<PayTab>('All');
  const [q, setQ] = useState('');
  const [sourceF, setSourceF] = useState('All Sources');
  const [modeF, setModeF] = useState('All Modes');
  const [dateF, setDateF] = useState('Today');
  const [deptF, setDeptF] = useState('All Departments');
  const [docF, setDocF] = useState('All Doctors');
  const [page, setPage] = useState(0);
  const { sort, onSort, sorted } = useSort<Appointment>();
  const [pay, setPay] = useState<Appointment | null>(null);
  const [receipt, setReceipt] = useState<Appointment | null>(null);
  const [refund, setRefund] = useState<Appointment | null>(null);

  /**
   * Audit 3.1.1 — Refresh re-reads the payment records out of the store and
   * the table re-derives from them, with the shared loading state while it
   * runs. No toast: the refreshed figures are the acknowledgement.
   */
  const reload = useCallback((): void => {
    const fresh = useAppointmentsStore.getState().appts;
    if (!Array.isArray(fresh)) throw new Error('The payment records are unavailable.');
  }, []);
  const { loading, error, updatedAt, refresh } = useListRefresh(reload);

  const paid = appts.filter((a) => a.payment === 'Paid');
  const deskPaid = paid.filter((a) => a.source === 'Walk-in' && a.date === 'Today'); // collected at the hospital desk today
  const onlinePaid = paid.filter((a) => a.source === 'Online' && a.date === 'Today'); // prepaid via Medibook (settled to hospital later)
  const deskTotal = deskPaid.reduce((s, a) => s + grossAmount(a), 0);
  const cash = deskPaid
    .filter((a) => (a.payMode ?? 'Cash') === 'Cash')
    .reduce((s, a) => s + grossAmount(a), 0);
  const onlineTotal = onlinePaid.reduce((s, a) => s + grossAmount(a), 0);
  const pendingCount = appts.filter((a) => a.payment === 'Pending').length;
  const KPIS: readonly StatCardData[] = [
    {
      icon: 'indian-rupee',
      label: 'Collected at Desk',
      value: money(deskTotal),
      sub: `${deskPaid.length} walk-in payment${deskPaid.length === 1 ? '' : 's'} · incl. GST`,
      iconClass: 'bg-g-100 text-g-600',
      valueClass: 'text-g-600',
    },
    {
      icon: 'banknote',
      label: 'Desk Cash',
      value: money(cash),
      sub: 'Cash at the counter',
      iconClass: 'bg-blue-soft-bg text-blue',
      valueClass: 'text-blue',
    },
    {
      icon: 'smartphone',
      label: 'Prepaid Online',
      value: money(onlineTotal),
      sub: 'via Medibook · settled later',
      iconClass: 'bg-y-100 text-y-600',
      valueClass: 'text-y-600',
    },
    {
      icon: 'circle-alert',
      label: 'Pending Collection',
      value: pendingCount,
      sub: 'Walk-ins to collect',
      iconClass: 'bg-d-100 text-d-500',
      valueClass: 'text-d-500',
    },
  ];
  const counts: Record<Exclude<PayTab, 'All'>, number> = {
    Paid: paid.length,
    Pending: pendingCount,
    Refunded: appts.filter((a) => a.payment === 'Refunded').length,
    Waived: appts.filter((a) => a.payment === 'Waived').length,
  };
  const ql = q.trim().toLowerCase();
  const filtered = appts.filter((a) => {
    if (tab !== 'All' && a.payment !== tab) return false;
    if (tab === 'All' && (a.payment === 'Refunded' || a.payment === 'Waived')) return false;
    if (sourceF !== 'All Sources' && a.source !== sourceF) return false;
    if (
      modeF !== 'All Modes' &&
      !(a.payment === 'Paid' && a.source === 'Walk-in' && (a.payMode ?? 'Cash') === modeF)
    )
      return false;
    if (deptF !== 'All Departments' && a.dept !== deptF) return false;
    if (docF !== 'All Doctors' && a.doctor !== docF) return false;
    if (dateF === 'Today' && a.date !== 'Today') return false;
    if (ql && !(a.name + ' ' + a.mrn).toLowerCase().includes(ql)) return false;
    return true;
  });
  const ACC: SortAccessors<Appointment> = {
    name: (a) => a.name,
    doctor: (a) => a.doctor,
    source: (a) => a.source,
    mode: (a) => a.payMode ?? '',
    amount: (a) => grossAmount(a),
    status: (a) => a.payment,
  };
  const ordered = sorted(filtered, ACC);
  const pages = Math.max(1, Math.ceil(ordered.length / PAY_PAGE));
  const pg = Math.min(page, pages - 1);
  const rows = ordered.slice(pg * PAY_PAGE, pg * PAY_PAGE + PAY_PAGE);
  const reset =
    <V,>(fn: (value: V) => void) =>
    (value: V): void => {
      fn(value);
      setPage(0);
    };
  const tabLabel = (t: PayTab): string => (t === 'All' ? 'All' : `${t} (${counts[t]})`);
  const onTab = (v: string): void => {
    setTab(v.split(' (')[0] as PayTab);
    setPage(0);
  };
  const filtersActive =
    ql !== '' ||
    dateF !== 'Today' ||
    sourceF !== 'All Sources' ||
    deptF !== 'All Departments' ||
    docF !== 'All Doctors' ||
    modeF !== 'All Modes';
  const clearAll = (): void => {
    setQ('');
    setDateF('Today');
    setSourceF('All Sources');
    setDeptF('All Departments');
    setDocF('All Doctors');
    setModeF('All Modes');
    setPage(0);
  };

  /** Minting on the way in keeps the receipt number out of render and stable. */
  const openReceipt = (a: Appointment): void => {
    ensureReceiptNo(a.id);
    setReceipt(useAppointmentsStore.getState().appts.find((x) => x.id === a.id) ?? a);
  };

  /**
   * A genuine file, through the shared `downloadCsv` — RFC-4180 escaping and a
   * UTF-8 BOM, so Excel renders the rupee sign. The tax columns make the export
   * reconcilable against the printed receipts.
   */
  const exportCsv = (): void => {
    const filename = 'medibook-payments.csv';
    const modeOf = (a: Appointment): string =>
      a.payment === 'Paid'
        ? a.source === 'Online'
          ? 'Prepaid (Online)'
          : (a.payMode ?? 'Cash')
        : '—';
    const rows: CsvCell[][] = [
      [
        'Receipt No.',
        'Patient',
        'MR Number',
        'Doctor',
        'Department',
        'Date',
        'Source',
        'Mode',
        'Reference',
        'Consultation',
        GST_LABEL,
        'Total',
        'Refunded',
        'Waived',
        'Status',
        'Hospital GSTIN',
      ],
      ...filtered.map((a): CsvCell[] => {
        const tax = taxBreakdown(a.amount);
        return [
          a.receiptNo ?? '',
          a.name,
          a.mrn,
          a.doctor,
          a.dept,
          a.date,
          a.source,
          modeOf(a),
          a.payRef ?? '',
          tax.subtotal,
          tax.gst,
          tax.total,
          a.refundAmount ?? 0,
          a.waivedAmount ?? 0,
          a.payment,
          HOSPITAL_GSTIN,
        ];
      }),
    ];
    downloadCsv(filename, rows);
    toast(`Exported ${filename}`, 'success');
  };

  /** Loading / empty / error live inside the table body so the header stays put. */
  const tableState: TableStateSpec | undefined = loading
    ? { kind: 'loading', rows: PAY_PAGE }
    : error
      ? { kind: 'error', message: error, onRetry: () => void refresh() }
      : rows.length === 0
        ? filtersActive
          ? {
              kind: 'empty',
              title: 'No payments match your filters.',
              message: 'Nothing was collected for this combination of date, source and mode.',
              actionLabel: 'Clear filters',
              onAction: clearAll,
            }
          : {
              kind: 'empty',
              icon: 'indian-rupee',
              title: 'No payments recorded yet.',
              message:
                'Walk-in payments appear here as the desk records them, prepaid online bookings as they arrive.',
            }
        : undefined;

  return (
    <div className="flex flex-col gap-5" data-role={role}>
      <KpiStrip items={KPIS} />
      <Card pad={14} className="flex flex-wrap items-center justify-between gap-4">
        <Tabs tabs={PAY_TABS.map(tabLabel)} value={tabLabel(tab)} onChange={onTab} />
        <span
          title={
            filtered.length === 0
              ? 'Nothing to export for these filters'
              : `Export ${filtered.length} record${filtered.length === 1 ? '' : 's'} as CSV`
          }
        >
          <Button
            variant="secondary"
            icon="download"
            onClick={exportCsv}
            disabled={filtered.length === 0}
          >
            Export CSV
          </Button>
        </span>
      </Card>
      <Card pad={20}>
        <div className="mb-4">
          <SearchField
            value={q}
            onChange={reset(setQ)}
            placeholder="Search by patient name or MR number"
          />
        </div>
        <div className="mb-4.5 flex flex-wrap items-center gap-3">
          <RefreshBtn onRefresh={refresh} title="Refresh payments" />
          <FilterSelect
            value={dateF}
            options={['Today', 'This Week', 'This Month']}
            onChange={reset(setDateF)}
            aria-label="Filter by date"
          />
          <FilterSelect
            value={sourceF}
            options={['All Sources', 'Walk-in', 'Online']}
            onChange={reset(setSourceF)}
            aria-label="Filter by booking source"
          />
          <FilterSelect
            value={deptF}
            options={['All Departments', ...departments]}
            onChange={reset(setDeptF)}
            aria-label="Filter by department"
          />
          <FilterSelect
            value={docF}
            options={['All Doctors', ...doctorNames]}
            onChange={reset(setDocF)}
            aria-label="Filter by doctor"
          />
          <FilterSelect
            value={modeF}
            options={['All Modes', 'Cash', 'UPI', 'Card']}
            onChange={reset(setModeF)}
            aria-label="Filter by payment mode"
          />
          {filtersActive && (
            <button type="button" onClick={clearAll} className="text-body text-blue cursor-pointer">
              Clear all
            </button>
          )}
          <InfoDot text="Walk-in payments are collected at the hospital desk (cash / UPI / card). Online bookings are prepaid through the Medibook app — Medibook collects them and settles the net to the hospital later, so they are shown as 'Prepaid'. Every amount shown includes 18% GST." />
          <span className="flex-1"></span>
          <span className="text-caption text-text-muted whitespace-nowrap">
            Updated {formatUpdatedAt(updatedAt)}
          </span>
        </div>
        <TableShell
          columns={COLUMNS}
          rightCols={['Amount']}
          sortKeys={{
            Patient: 'name',
            'Doctor / Dept': 'doctor',
            Source: 'source',
            Mode: 'mode',
            Amount: 'amount',
            Status: 'status',
          }}
          sort={sort}
          onSort={onSort}
          state={tableState}
          scrollLabel="Payments"
        >
          {rows.map((a) => (
            <tr key={a.id} className="hover:bg-grey-200 transition-colors duration-150">
              <td className={cn(tdClass, 'text-text-strong font-medium')}>
                {a.name}
                <div className="text-caption text-text-muted font-normal">{a.mrn}</div>
              </td>
              <td className={tdClass}>
                {a.doctor}
                <div className="text-caption text-text-muted">{a.dept}</div>
              </td>
              <td className={tdClass}>
                <Badge status={a.source} />
              </td>
              <td className={tdClass}>
                {a.payment === 'Paid' ? (
                  a.source === 'Online' ? (
                    <span className="text-text-muted">Prepaid</span>
                  ) : (
                    (a.payMode ?? 'Cash')
                  )
                ) : (
                  '—'
                )}
              </td>
              <td className={cn(tdClass, 'text-right')}>
                <div className="text-text-strong font-semibold tabular-nums">
                  {money(grossAmount(a))}
                </div>
                <div className="text-caption text-text-muted tabular-nums">
                  incl. {money(taxBreakdown(a.amount).gst)} GST
                </div>
              </td>
              <td className={tdClass}>
                <div className="flex flex-col items-start gap-0.75">
                  <Badge status={a.payment} />
                  {a.payment === 'Refunded' && a.refundAmount != null && (
                    <span className="text-caption text-text-muted tabular-nums">
                      −{money(a.refundAmount)}{' '}
                      {a.refundVia === 'Medibook' ? 'via Medibook' : 'at desk'}
                    </span>
                  )}
                </div>
              </td>
              <td className={tdClass}>
                <div className="flex items-center gap-2">
                  {a.payment === 'Pending' && (
                    <Can perm="Payments.add">
                      <Button size="sm" icon="indian-rupee" onClick={() => setPay(a)}>
                        Record
                      </Button>
                    </Can>
                  )}
                  {(a.payment === 'Paid' || a.payment === 'Refunded') && (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon="receipt"
                      onClick={() => openReceipt(a)}
                    >
                      Receipt
                    </Button>
                  )}
                  {/* HA-09: the refund control is reachable for prepaid online
                      bookings too, not only for paid walk-ins. */}
                  {a.payment === 'Paid' && (
                    <Can perm={['Payments.del', 'Appointments.del']}>
                      <Button size="sm" variant="ghost" icon="undo-2" onClick={() => setRefund(a)}>
                        Refund
                      </Button>
                    </Can>
                  )}
                  {a.payment === 'Waived' && (
                    <span className="text-caption text-text-muted">
                      {a.waiveReason || 'Fee waived'}
                    </span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </TableShell>
        <Pager
          total={filtered.length}
          page={pg}
          pageSize={PAY_PAGE}
          onPage={setPage}
          noun="records"
          right={
            <span className="text-body text-text-navy font-medium tabular-nums">
              Desk collected: {money(deskTotal)}
            </span>
          }
        />
      </Card>
      <MarkPaymentModal
        appt={pay}
        onClose={() => setPay(null)}
        onPaid={() => {
          const current = pay;
          setPay(null);
          if (!current) return;
          const fresh =
            useAppointmentsStore.getState().appts.find((x) => x.id === current.id) ?? null;
          setReceipt(fresh);
        }}
      />
      <ReceiptModal appt={receipt} onClose={() => setReceipt(null)} />
      <RefundModal appt={refund} onClose={() => setRefund(null)} />
    </div>
  );
}
