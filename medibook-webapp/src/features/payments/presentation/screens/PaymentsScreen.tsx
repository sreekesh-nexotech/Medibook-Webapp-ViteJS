import { useState } from 'react';
import { useParams } from 'react-router-dom';

import { isFailure } from '@/core/error/failure';

import { cn } from '@/shared/lib/cn';
import { downloadTextFile } from '@/shared/lib/download';
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

import type { DeskAppointment } from '@/features/appointments/domain/entities/appointments.entities';
import { useRefundMutation } from '@/features/appointments/application/queries/appointments.mutations';
import { useAppointmentsQuery } from '@/features/appointments/application/queries/appointments.queries';
import { AppointmentPaymentModal } from '@/features/appointments/presentation/components/AppointmentPaymentModal';
import { AppointmentReasonModal } from '@/features/appointments/presentation/components/AppointmentReasonModal';
import { AppointmentReceiptModal } from '@/features/appointments/presentation/components/AppointmentReceiptModal';
import { useDepartmentsQuery } from '@/features/doctors/application/queries/useDepartmentsQuery';
import { useDoctorsQuery } from '@/features/doctors/application/queries/useDoctorsQuery';
import type {
  PaymentFilters,
  PaymentLine,
  PaymentLineStatus,
} from '@/features/payments/domain/entities/payments.entities';
import { useExportPaymentsMutation } from '@/features/payments/application/queries/useExportPaymentsMutation';
import { useInvalidatePayments } from '@/features/payments/application/queries/useInvalidatePayments';
import { usePaymentRefundsQuery } from '@/features/payments/application/queries/usePaymentRefundsQuery';
import { usePaymentsQuery } from '@/features/payments/application/queries/usePaymentsQuery';
import { usePaymentTotalsQuery } from '@/features/payments/application/queries/usePaymentTotalsQuery';
import { PaymentsVisitReceiptsModal } from '@/features/payments/presentation/components/PaymentsVisitReceiptsModal';
import {
  LINE_STATUS_LABEL,
  METHOD_LABEL,
  MODE_FILTER,
  PAYMENT_WINDOWS,
  type PaymentWindow,
  rangeForWindow,
  refundCopy,
  totalsOf,
  updatedCopy,
} from '@/features/payments/presentation/components/payments.view';

/** Payment tabs. `Pending` lists unpaid walk-ins (appointments), not payment lines. */
type PayTab = 'All' | 'Paid' | 'Pending' | 'Refunded';

const PAY_TABS: readonly PayTab[] = ['All', 'Paid', 'Pending', 'Refunded'];

/** Server status per tab that shows payment lines. */
const TAB_STATUS: Readonly<Record<Exclude<PayTab, 'Pending'>, PaymentLineStatus>> = {
  All: 'captured',
  Paid: 'captured',
  Refunded: 'refunded',
};

/** Records shown per page (design `PAY_PAGE`). */
const PAY_PAGE = 9;

const COLUMNS = ['Patient', 'Doctor / Dept', 'Source', 'Mode', 'Amount', 'Status', 'Action'];

const ALL_SOURCES = 'All Sources';
const ALL_MODES = 'All Modes';
const ALL_DEPTS = 'All Departments';
const ALL_DOCTORS = 'All Doctors';
const SOURCE_WALK_IN = 'Walk-in';
const SOURCE_ONLINE = 'Online';

const CSV_FILENAME = 'medibook-payments.csv';
const CSV_MIME = 'text/csv';

const REFUND_COPY = {
  title: 'Refund Payment',
  body: 'The full amount is refunded — one refund per payment line, to its original method. Cash is handed back from your open cash session.',
  confirm: 'Refund in full',
};

/** One table row: a payment line, or an unpaid walk-in waiting at the desk. */
type PayRow =
  | { readonly kind: 'line'; readonly line: PaymentLine }
  | { readonly kind: 'pending'; readonly appt: DeskAppointment };

function errorCopy(error: unknown): string | undefined {
  return isFailure(error) ? error.message : undefined;
}

/**
 * Payments (module H9) — payment lines from `/hospital/payments` (desk and
 * online, D-27) plus the unpaid walk-ins from the appointments feature, which
 * is where they are collected. Collect, receipt and refund reuse that
 * feature's modals, as the integration plan prescribes; a desk visit paid as
 * one line lists its per-consultation receipts.
 *
 * Amounts are what was collected. The tax breakdown lives on each receipt.
 */
export function PaymentsScreen() {
  const { role } = useParams();

  const [tab, setTab] = useState<PayTab>('All');
  const [q, setQ] = useState('');
  const [sourceF, setSourceF] = useState(ALL_SOURCES);
  const [modeF, setModeF] = useState(ALL_MODES);
  const [dateF, setDateF] = useState<PaymentWindow>('Today');
  const [deptF, setDeptF] = useState(ALL_DEPTS);
  const [docF, setDocF] = useState(ALL_DOCTORS);
  const [page, setPage] = useState(0);
  const [pay, setPay] = useState<DeskAppointment | null>(null);
  const [receiptFor, setReceiptFor] = useState<string | null>(null);
  const [visitFor, setVisitFor] = useState<PaymentLine | null>(null);
  const [refundFor, setRefundFor] = useState<PaymentLine | null>(null);

  const departments = useDepartmentsQuery().data ?? [];
  const doctors = useDoctorsQuery().data ?? [];
  const invalidatePayments = useInvalidatePayments();
  const refund = useRefundMutation();
  const exportCsv = useExportPaymentsMutation();

  const range = rangeForWindow(dateF);
  const today = rangeForWindow('Today');
  const departmentId = departments.find((d) => d.name === deptF)?.id ?? null;
  const doctorId = doctors.find((d) => d.name === docF)?.id ?? null;

  const filters: PaymentFilters = {
    ...range,
    status: tab === 'Pending' ? null : TAB_STATUS[tab],
    method: MODE_FILTER[modeF] ?? null,
    doctorId,
    departmentId,
    q,
  };
  const showsLines = tab !== 'Pending';
  const linesQuery = usePaymentsQuery(
    { ...filters, page: page + 1, pageSize: PAY_PAGE },
    showsLines,
  );
  const apptsQuery = useAppointmentsQuery(range);
  const todayApptsQuery = useAppointmentsQuery(today);
  const totalsQuery = usePaymentTotalsQuery({
    ...today,
    status: 'captured',
    method: null,
    doctorId: null,
    departmentId: null,
    q: '',
  });

  const appts = apptsQuery.data ?? [];
  const apptById = new Map(appts.map((a) => [a.id, a]));
  const totals = totalsOf(totalsQuery.data ?? []);
  const isUnpaid = (a: DeskAppointment): boolean =>
    a.paymentStatus === 'unpaid' && a.status !== 'cancelled' && a.status !== 'no_show';
  const pendingToday = (todayApptsQuery.data ?? []).filter(isUnpaid).length;

  const ql = q.trim().toLowerCase();
  const pendingRows = appts.filter(
    (a) =>
      isUnpaid(a) &&
      (sourceF === ALL_SOURCES || sourceF === SOURCE_WALK_IN) &&
      modeF === ALL_MODES &&
      (deptF === ALL_DEPTS || a.department.name === deptF) &&
      (docF === ALL_DOCTORS || a.doctor.name === docF) &&
      (!ql ||
        `${a.patient?.fullName ?? ''} ${a.patient?.mrn ?? ''} ${a.bookingRef}`
          .toLowerCase()
          .includes(ql)),
  );

  // Source has no server filter: it narrows the current page only (the
  // caption below says so).
  const lines = (linesQuery.data?.items ?? []).filter(
    (l) =>
      sourceF === ALL_SOURCES ||
      (sourceF === SOURCE_ONLINE ? l.channel === 'online' : l.channel === 'desk'),
  );
  const refunds = usePaymentRefundsQuery(
    lines.filter((l) => l.status === 'refunded').map((l) => l.id),
  );

  const pendingPage = pendingRows.slice(page * PAY_PAGE, page * PAY_PAGE + PAY_PAGE);
  const rows: readonly PayRow[] =
    tab === 'Pending'
      ? pendingPage.map((appt) => ({ kind: 'pending', appt }))
      : [
          ...(tab === 'All' && page === 0
            ? pendingRows.map((appt): PayRow => ({ kind: 'pending', appt }))
            : []),
          ...lines.map((line): PayRow => ({ kind: 'line', line })),
        ];
  const total = tab === 'Pending' ? pendingRows.length : (linesQuery.data?.total ?? 0);

  const KPIS: readonly StatCardData[] = [
    {
      icon: 'indian-rupee',
      label: 'Collected at Desk',
      value: totalsQuery.data ? money(totals.deskTotal) : '—',
      sub: `${totals.deskCount} desk payment${totals.deskCount === 1 ? '' : 's'} today · as collected`,
      iconClass: 'bg-g-100 text-g-600',
      valueClass: 'text-g-600',
    },
    {
      icon: 'banknote',
      label: 'Desk Cash',
      value: totalsQuery.data ? money(totals.deskCash) : '—',
      sub: 'Cash at the counter today',
      iconClass: 'bg-blue-soft-bg text-blue',
      valueClass: 'text-blue',
    },
    {
      icon: 'smartphone',
      label: 'Prepaid Online',
      value: totalsQuery.data ? money(totals.onlineTotal) : '—',
      sub: 'via Medibook · settled later',
      iconClass: 'bg-y-100 text-y-600',
      valueClass: 'text-y-600',
    },
    {
      icon: 'circle-alert',
      label: 'Pending Collection',
      value: todayApptsQuery.data ? pendingToday : '—',
      sub: 'Walk-ins to collect today',
      iconClass: 'bg-d-100 text-d-500',
      valueClass: 'text-d-500',
    },
  ];

  const tabLabel = (t: PayTab): string => (t === 'Pending' ? `Pending (${pendingRows.length})` : t);
  const onTab = (v: string): void => {
    setTab(PAY_TABS.find((t) => v.startsWith(t)) ?? 'All');
    setPage(0);
  };
  const reset =
    <V,>(fn: (value: V) => void) =>
    (value: V): void => {
      fn(value);
      setPage(0);
    };
  const filtersActive =
    ql !== '' ||
    dateF !== 'Today' ||
    sourceF !== ALL_SOURCES ||
    deptF !== ALL_DEPTS ||
    docF !== ALL_DOCTORS ||
    modeF !== ALL_MODES;
  const clearAll = (): void => {
    setQ('');
    setDateF('Today');
    setSourceF(ALL_SOURCES);
    setDeptF(ALL_DEPTS);
    setDocF(ALL_DOCTORS);
    setModeF(ALL_MODES);
    setPage(0);
  };

  const refresh = async (): Promise<void> => {
    await Promise.all([
      showsLines ? linesQuery.refetch() : Promise.resolve(),
      apptsQuery.refetch(),
      totalsQuery.refetch(),
      todayApptsQuery.refetch(),
    ]);
  };

  const runExport = (): void => {
    exportCsv.mutate(filters, {
      onSuccess: (csv) => {
        downloadTextFile(CSV_FILENAME, csv, CSV_MIME);
        toast(`Exported ${CSV_FILENAME}`, 'success');
      },
      onError: (error) => toast(errorCopy(error) ?? 'The export failed.', 'error'),
    });
  };

  const confirmRefund = (reason: string): void => {
    const line = refundFor;
    if (!line?.appointmentId) return;
    refund.mutate(
      { id: line.appointmentId, reason },
      {
        onSuccess: () => {
          toast('Refund issued', 'success');
          setRefundFor(null);
          invalidatePayments();
        },
        onError: (error) => toast(errorCopy(error) ?? 'The refund failed.', 'error'),
      },
    );
  };

  const doctorDept = (row: PayRow): { readonly main: string; readonly sub: string } => {
    if (row.kind === 'pending') {
      return { main: row.appt.doctor.name, sub: row.appt.department.name };
    }
    const { line } = row;
    if (line.visitId) {
      return {
        main: `${line.bookingRefs.length} consultation${line.bookingRefs.length === 1 ? '' : 's'}`,
        sub: 'Desk visit',
      };
    }
    const appt = line.appointmentId ? apptById.get(line.appointmentId) : undefined;
    return appt
      ? { main: appt.doctor.name, sub: appt.department.name }
      : { main: line.bookingRefs.join(', ') || '—', sub: 'Booking' };
  };

  const loading =
    (showsLines && linesQuery.isPending) ||
    (tab !== 'Paid' && tab !== 'Refunded' && apptsQuery.isPending);
  const failed = (showsLines && linesQuery.isError) || (!showsLines && apptsQuery.isError);
  const tableState: TableStateSpec | undefined = loading
    ? { kind: 'loading', rows: PAY_PAGE }
    : failed
      ? {
          kind: 'error',
          message: errorCopy(linesQuery.error ?? apptsQuery.error),
          onRetry: () => void refresh(),
        }
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
              title:
                tab === 'Pending'
                  ? 'Nothing waiting to be collected.'
                  : 'No payments recorded yet.',
              message:
                'Desk payments appear here as they are recorded, prepaid online bookings as they arrive.',
            }
        : undefined;

  const updatedAt = Math.max(linesQuery.dataUpdatedAt, apptsQuery.dataUpdatedAt);

  return (
    <div className="flex flex-col gap-5" data-role={role}>
      <KpiStrip items={KPIS} />
      <Card pad={14} className="flex flex-wrap items-center justify-between gap-4">
        <Tabs tabs={PAY_TABS.map(tabLabel)} value={tabLabel(tab)} onChange={onTab} />
        <span
          title={
            tab === 'Pending'
              ? 'Unpaid walk-ins are not payment lines — nothing to export'
              : 'Export every payment line matching these filters as CSV'
          }
        >
          <Button
            variant="secondary"
            icon="download"
            onClick={runExport}
            busy={exportCsv.isPending}
            disabled={tab === 'Pending' || total === 0}
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
            placeholder="Search by patient name, MR number or booking ref"
          />
        </div>
        <div className="mb-4.5 flex flex-wrap items-center gap-3">
          <RefreshBtn onRefresh={refresh} title="Refresh payments" />
          <FilterSelect
            value={dateF}
            options={PAYMENT_WINDOWS}
            onChange={reset((v: string) =>
              setDateF(PAYMENT_WINDOWS.find((w) => w === v) ?? 'Today'),
            )}
            aria-label="Filter by date"
          />
          <FilterSelect
            value={sourceF}
            options={[ALL_SOURCES, SOURCE_WALK_IN, SOURCE_ONLINE]}
            onChange={reset(setSourceF)}
            aria-label="Filter by booking source"
          />
          <FilterSelect
            value={deptF}
            options={[ALL_DEPTS, ...departments.map((d) => d.name)]}
            onChange={reset(setDeptF)}
            aria-label="Filter by department"
          />
          <FilterSelect
            value={docF}
            options={[ALL_DOCTORS, ...doctors.map((d) => d.name)]}
            onChange={reset(setDocF)}
            aria-label="Filter by doctor"
          />
          <FilterSelect
            value={modeF}
            options={[ALL_MODES, ...Object.keys(MODE_FILTER)]}
            onChange={reset(setModeF)}
            aria-label="Filter by payment mode"
          />
          {filtersActive && (
            <button type="button" onClick={clearAll} className="text-body text-blue cursor-pointer">
              Clear all
            </button>
          )}
          <InfoDot text="Desk payments are collected at the hospital (cash / UPI / card). Online bookings are prepaid through the Medibook app — Medibook collects them and settles the net to the hospital later, so they are shown as 'Prepaid'. Amounts are as collected; each receipt shows its tax breakdown." />
          <span className="flex-1"></span>
          <span className="text-caption text-text-muted whitespace-nowrap">
            Updated {updatedCopy(updatedAt)}
          </span>
        </div>
        {sourceF !== ALL_SOURCES && showsLines && (
          <div className="text-caption text-text-muted mb-3">
            Source filters this page only — the server cannot filter payments by source.
          </div>
        )}
        <TableShell
          columns={COLUMNS}
          rightCols={['Amount']}
          state={tableState}
          scrollLabel="Payments"
        >
          {rows.map((row) => {
            const dd = doctorDept(row);
            if (row.kind === 'pending') {
              const { appt } = row;
              return (
                <tr
                  key={`pending-${appt.id}`}
                  className="hover:bg-grey-200 transition-colors duration-150"
                >
                  <td className={cn(tdClass, 'text-text-strong font-medium')}>
                    {appt.patient?.fullName ?? 'Patient unavailable'}
                    <div className="text-caption text-text-muted font-normal">
                      {appt.patient?.mrn ?? appt.bookingRef}
                    </div>
                  </td>
                  <td className={tdClass}>
                    {dd.main}
                    <div className="text-caption text-text-muted">{dd.sub}</div>
                  </td>
                  <td className={tdClass}>
                    <Badge status={appt.source === 'online' ? SOURCE_ONLINE : SOURCE_WALK_IN} />
                  </td>
                  <td className={tdClass}>—</td>
                  <td className={cn(tdClass, 'text-right')}>
                    <div className="text-text-strong font-semibold tabular-nums">
                      {money(appt.totalRupees)}
                    </div>
                    <div className="text-caption text-text-muted">due</div>
                  </td>
                  <td className={tdClass}>
                    <Badge status="Pending" />
                  </td>
                  <td className={tdClass}>
                    <Can perm="Payments.add">
                      <Button size="sm" icon="indian-rupee" onClick={() => setPay(appt)}>
                        Record
                      </Button>
                    </Can>
                  </td>
                </tr>
              );
            }
            const { line } = row;
            const refunded = line.status === 'refunded' ? refundCopy(refunds[line.id] ?? []) : null;
            return (
              <tr key={line.id} className="hover:bg-grey-200 transition-colors duration-150">
                <td className={cn(tdClass, 'text-text-strong font-medium')}>
                  {line.patient?.fullName ?? 'Patient unavailable'}
                  <div className="text-caption text-text-muted font-normal">
                    {line.patient?.mrn ?? line.bookingRefs.join(', ')}
                  </div>
                </td>
                <td className={tdClass}>
                  {dd.main}
                  <div className="text-caption text-text-muted">{dd.sub}</div>
                </td>
                <td className={tdClass}>
                  <Badge status={line.channel === 'online' ? SOURCE_ONLINE : SOURCE_WALK_IN} />
                </td>
                <td className={tdClass}>
                  {line.channel === 'online' ? (
                    <span className="text-text-muted">Prepaid</span>
                  ) : (
                    METHOD_LABEL[line.method]
                  )}
                  {line.collectedByName && (
                    <div className="text-caption text-text-muted">
                      {line.collectedByName}
                      {line.counterCode ? ` · ${line.counterCode}` : ''}
                    </div>
                  )}
                </td>
                <td className={cn(tdClass, 'text-right')}>
                  <div className="text-text-strong font-semibold tabular-nums">
                    {money(line.amountRupees)}
                  </div>
                </td>
                <td className={tdClass}>
                  <div className="flex flex-col items-start gap-0.75">
                    <Badge status={LINE_STATUS_LABEL[line.status]} />
                    {refunded && (
                      <span className="text-caption text-text-muted tabular-nums">
                        −{money(refunded.amount)} {refunded.how}
                      </span>
                    )}
                  </div>
                </td>
                <td className={tdClass}>
                  <div className="flex items-center gap-2">
                    {line.status !== 'failed' && line.appointmentId && (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon="receipt"
                        onClick={() => setReceiptFor(line.appointmentId)}
                      >
                        Receipt
                      </Button>
                    )}
                    {line.status !== 'failed' && line.visitId && (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon="receipt"
                        onClick={() => setVisitFor(line)}
                      >
                        Receipts
                      </Button>
                    )}
                    {/* HA-09: refund is reachable for prepaid online lines too. A
                        visit line has no refund endpoint (refunds are per
                        appointment), so it offers none. */}
                    {line.status === 'captured' && line.appointmentId && (
                      <Can perm={['Payments.del', 'Appointments.del']}>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon="undo-2"
                          onClick={() => setRefundFor(line)}
                        >
                          Refund
                        </Button>
                      </Can>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </TableShell>
        <Pager
          total={total}
          page={page}
          pageSize={PAY_PAGE}
          onPage={setPage}
          noun={tab === 'Pending' ? 'unpaid walk-ins' : 'payment lines'}
          right={
            <span className="text-body text-text-navy font-medium tabular-nums">
              Desk collected today: {money(totals.deskTotal)}
              {tab === 'All' && pendingRows.length > 0
                ? ` · ${pendingRows.length} unpaid walk-in${pendingRows.length === 1 ? '' : 's'} listed first`
                : ''}
            </span>
          }
        />
      </Card>
      <AppointmentPaymentModal
        appt={pay}
        onClose={() => setPay(null)}
        onPaid={() => {
          const paid = pay;
          setPay(null);
          invalidatePayments();
          if (paid) setReceiptFor(paid.id);
        }}
      />
      <AppointmentReceiptModal appointmentId={receiptFor} onClose={() => setReceiptFor(null)} />
      <PaymentsVisitReceiptsModal
        visitId={visitFor?.visitId ?? null}
        bookingRefs={visitFor?.bookingRefs ?? []}
        onClose={() => setVisitFor(null)}
        onOpenReceipt={(appointmentId) => {
          setVisitFor(null);
          setReceiptFor(appointmentId);
        }}
      />
      <AppointmentReasonModal
        open={refundFor !== null}
        title={REFUND_COPY.title}
        body={REFUND_COPY.body}
        confirmLabel={REFUND_COPY.confirm}
        busy={refund.isPending}
        onClose={() => setRefundFor(null)}
        onConfirm={confirmRefund}
      />
    </div>
  );
}
