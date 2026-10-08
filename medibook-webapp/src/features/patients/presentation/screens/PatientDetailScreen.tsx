import type { ReactNode } from 'react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { isFailure } from '@/core/error/failure';
import { useHospitalToday } from '@/shared/hooks/useHospitalTime';
import { useCan } from '@/shared/hooks/usePermission';
import { cn } from '@/shared/lib/cn';
import { fmtDate, money } from '@/shared/lib/format';
import { formatTimeIn } from '@/shared/lib/hospitalTime';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Can } from '@/shared/ui/Can';
import { Card } from '@/shared/ui/Card';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Icon } from '@/shared/ui/Icon';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SkeletonCards } from '@/shared/ui/Skeleton';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { toast } from '@/shared/ui/toast/toast.store';

import { hospitalBookForPatientPath, hospitalPath, isHospitalRole } from '@/app/router/paths';

import { useDeletePatientMutation } from '@/features/patients/application/queries/useDeletePatientMutation';
import { usePatientAppointmentsQuery } from '@/features/patients/application/queries/usePatientAppointmentsQuery';
import { usePatientByMrnQuery } from '@/features/patients/application/queries/usePatientByMrnQuery';
import type {
  AppointmentPaymentStatus,
  AppointmentStatus,
  PatientAppointment,
} from '@/features/patients/domain/entities/patients.entities';
import { PatientChangeNotice } from '@/features/patients/presentation/components/PatientChangeNotice';
import { PatientModal } from '@/features/patients/presentation/components/PatientModal';
import {
  ageFromDob,
  ageText,
  appointmentSourceBadge,
  appointmentStatusBadge,
  displayPhone,
  formatAddress,
  genderLabel,
  paiseToRupees,
  patientSourceBadge,
  paymentBadge,
  saveErrorMessage,
} from '@/features/patients/presentation/components/patientsFormat';

/**
 * Patient Detail (no medical data) — identity, contact, booking history and a
 * billing summary. The MRN comes from the URL (`:mrn`) and is resolved to the
 * hospital's record through the API.
 */

const HISTORY_COLUMNS = ['Date', 'Doctor / Dept', 'Source', 'Payment', 'Token', 'Status'];

const DELETE_FAILED = 'The record could not be deleted. Please try again.';

/** Why Edit / Delete are off while a request waits (the backend answers `409 APPROVAL_PENDING`). */
const PENDING_REQUEST_TITLE =
  'A change to this record is waiting for an administrator. Edit again once it is decided.';
const HISTORY_LOADING_ROWS = 3;

/** Still owed: not paid yet, on a visit that has not been called off. */
const OUTSTANDING_PAYMENTS: ReadonlySet<AppointmentPaymentStatus> = new Set(['unpaid', 'pending']);
const CALLED_OFF: ReadonlySet<AppointmentStatus> = new Set(['cancelled', 'no_show']);

function sumPaise(list: readonly PatientAppointment[], keep: (a: PatientAppointment) => boolean) {
  return list.filter(keep).reduce((s, a) => s + a.totalPaise, 0);
}

export function PatientDetailScreen() {
  const navigate = useNavigate();
  const { role, mrn } = useParams();
  const hospitalRole = isHospitalRole(role) ? role : 'receptionist';

  const patientQuery = usePatientByMrnQuery(mrn);
  const rec = patientQuery.data;
  const historyQuery = usePatientAppointmentsQuery(rec?.id);

  const [edit, setEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const canBook = useCan('Appointments.add');
  const deletion = useDeletePatientMutation();
  // Age and visit times on the hospital's calendar and clock (D-09, UAT-47).
  const { today, timeZone } = useHospitalToday();
  const backToList = () => navigate(hospitalPath(hospitalRole, 'patients'));

  if (!mrn) {
    return (
      <Card pad={32}>
        <EmptyState
          icon="user-x"
          title="No patient selected."
          message="Pick a record from the patients list to see its contact details and booking history."
          actionLabel="Back to patients"
          onAction={backToList}
        />
      </Card>
    );
  }

  if (patientQuery.isPending) return <SkeletonCards count={1} lines={4} pad={22} />;

  if (patientQuery.isError) {
    const isMissing = isFailure(patientQuery.error) && patientQuery.error.kind === 'notFound';
    return (
      <Card pad={32}>
        {isMissing ? (
          <EmptyState
            icon="user-x"
            title="Patient not found."
            message={`No record with MR number ${mrn} exists at this hospital.`}
            actionLabel="Back to patients"
            onAction={backToList}
          />
        ) : (
          <ErrorState
            inline
            title="This patient didn't load"
            message={patientQuery.error.message}
            onRetry={() => void patientQuery.refetch()}
          />
        )}
      </Card>
    );
  }

  const p = patientQuery.data;
  const list = historyQuery.data?.items ?? [];
  const totalBookings = historyQuery.data?.total ?? 0;
  // Cancelled, no-show and upcoming bookings are not visits.
  const completedVisits = list.filter((a) => a.status === 'completed').length;
  const age = ageFromDob(p.dateOfBirth, today);
  const phone = displayPhone(p.phone);
  const gender = genderLabel(p.gender);
  const address = formatAddress(p);
  const source = patientSourceBadge(p.source);

  // Gross amounts incl. tax, so they match what the receipts print.
  const totalPaid = sumPaise(list, (a) => a.paymentStatus === 'paid');
  const pending = sumPaise(
    list,
    (a) => OUTSTANDING_PAYMENTS.has(a.paymentStatus) && !CALLED_OFF.has(a.status),
  );

  const infoRow = (k: string, v: ReactNode) => (
    <div className="border-border-soft flex justify-between border-b py-2.75">
      <span className="text-body text-text-muted">{k}</span>
      <span className="text-body text-text-strong text-right font-medium">{v}</span>
    </div>
  );

  const book = () => {
    navigate(hospitalBookForPatientPath(hospitalRole, p.mrn));
  };

  const hasPendingChange = p.pendingChange !== null;

  const handleDelete = (): void => {
    setConfirmDelete(false);
    deletion.mutate(
      { id: p.id, version: p.version },
      {
        onSuccess: (outcome) => {
          if (outcome.status === 'deleted') {
            toast(`${p.fullName}’s record was deleted`, 'success');
            backToList();
            return;
          }
          toast('Deletion sent to an admin for approval', 'info');
        },
        onError: (error) => toast(saveErrorMessage(error, DELETE_FAILED), 'error'),
      },
    );
  };

  const historyState: TableStateSpec | undefined = historyQuery.isPending
    ? { kind: 'loading', rows: HISTORY_LOADING_ROWS }
    : historyQuery.isError
      ? {
          kind: 'error',
          message: historyQuery.error.message,
          onRetry: () => void historyQuery.refetch(),
        }
      : undefined;

  return (
    <div className="flex flex-col gap-5">
      <Card pad={22} className="flex items-center gap-5">
        <Avatar name={p.fullName} size={64} />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-h1 text-text-strong">{p.fullName}</span>
            {p.pendingChange ? (
              <Badge status="Pending">Pending approval</Badge>
            ) : (
              <Badge status={source.status}>{source.label}</Badge>
            )}
            {p.isLinked && (
              <span title="This record is the same person as a Medibook app account">
                <Badge status="Medibook">Medibook account</Badge>
              </span>
            )}
          </div>
          <div className="text-body text-text-muted mt-1.25 flex flex-wrap gap-4">
            <span>MR: {p.mrn}</span>
            {p.legacyMrn && (
              <>
                <span>·</span>
                <span title="The number from the hospital's earlier system">
                  Legacy MR: {p.legacyMrn}
                </span>
              </>
            )}
            <span>·</span>
            <span>
              {ageText(age)} · {gender || '—'}
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1.25">
              <Icon name="phone" size={14} /> {phone || '—'}
            </span>
          </div>
        </div>
        <Can perm="Patients.edit">
          <span title={hasPendingChange ? PENDING_REQUEST_TITLE : undefined}>
            <Button
              variant="secondary"
              icon="pencil"
              disabled={hasPendingChange}
              onClick={() => setEdit(true)}
            >
              Edit
            </Button>
          </span>
        </Can>
        <Can perm="Patients.del">
          <span title={hasPendingChange ? PENDING_REQUEST_TITLE : undefined}>
            <Button
              variant="ghost"
              icon="trash-2"
              disabled={hasPendingChange}
              busy={deletion.isPending}
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </Button>
          </span>
        </Can>
        <Can perm="Appointments.add">
          <Button icon="calendar-plus" onClick={book}>
            New Appointment
          </Button>
        </Can>
      </Card>
      {p.pendingChange && (
        <PatientChangeNotice
          change={p.pendingChange}
          onDecided={(decision) => {
            // An approved deletion removes the record: leave its page (F12).
            if (decision.kind === 'delete' && decision.status === 'approved') backToList();
          }}
        />
      )}
      <div className="flex gap-5">
        <div className="flex flex-[2] flex-col gap-5">
          <Card>
            <SectionTitle size={16} className="mb-3.5">
              Booking History
            </SectionTitle>
            {historyQuery.isSuccess && list.length === 0 ? (
              <EmptyState
                compact
                icon="calendar-plus"
                title="No appointments yet for this patient."
                message="Book the first visit and it will appear here with its token and payment."
                actionLabel={canBook ? 'Book appointment' : undefined}
                actionIcon="calendar-plus"
                onAction={canBook ? book : undefined}
              />
            ) : (
              <TableShell columns={HISTORY_COLUMNS} state={historyState}>
                {list.map((a) => {
                  const src = appointmentSourceBadge(a.source);
                  const pay = paymentBadge(a.paymentStatus, a.status);
                  const st = appointmentStatusBadge(a.status);
                  return (
                    <tr key={a.id}>
                      <td className={tdClass}>
                        {fmtDate(a.scheduledDate)}
                        <div className="text-caption text-text-muted">
                          {formatTimeIn(a.scheduledStartAt, timeZone)}
                        </div>
                      </td>
                      <td className={tdClass}>
                        {a.doctorName}
                        <div className="text-caption text-text-muted">{a.departmentName}</div>
                      </td>
                      <td className={tdClass}>
                        <Badge status={src.status}>{src.label}</Badge>
                      </td>
                      <td className={tdClass}>
                        <Badge status={pay.status}>{pay.label}</Badge>
                      </td>
                      <td className={tdClass}>
                        {/* A cancelled booking's token is released and reused
                            (BACKEND_BLOCKERS APPT-07), so it is not shown. */}
                        {a.status === 'cancelled' ? '—' : a.tokenLabel || '—'}
                      </td>
                      <td className={tdClass}>
                        <Badge status={st.status}>{st.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </TableShell>
            )}
          </Card>
        </div>
        <div className="flex flex-1 flex-col gap-5">
          <Card>
            <SectionTitle size={16} className="mb-2">
              Contact Details
            </SectionTitle>
            {infoRow('Phone', phone || '—')}
            {infoRow('Email', p.email || '—')}
            {infoRow('Gender', gender || '—')}
            {infoRow('Age', ageText(age))}
            <div className="flex justify-between gap-4 py-2.75">
              <span className="text-body text-text-muted">Address</span>
              <span className="text-body text-text-strong max-w-45 text-right font-medium">
                {address || '—'}
              </span>
            </div>
          </Card>
          <Card>
            <SectionTitle size={16} className="mb-2">
              Billing Summary
            </SectionTitle>
            {infoRow('Completed Visits', historyQuery.isSuccess ? completedVisits : '—')}
            {infoRow('Bookings', historyQuery.isSuccess ? totalBookings : '—')}
            {infoRow(
              'Total Paid',
              <span className="tabular-nums">
                {historyQuery.isSuccess ? money(paiseToRupees(totalPaid)) : '—'}
              </span>,
            )}
            {infoRow(
              'Outstanding',
              <span className={cn('tabular-nums', pending ? 'text-d-500' : 'text-text-strong')}>
                {historyQuery.isSuccess ? money(paiseToRupees(pending)) : '—'}
              </span>,
            )}
            <div className="text-caption text-text-muted pt-2">
              Figures include GST, as shown on the receipts
              {totalBookings > list.length ? `, for the latest ${list.length} bookings` : ''}.
            </div>
          </Card>
        </div>
      </div>
      <PatientModal open={edit} patient={p} onClose={() => setEdit(false)} />
      <ConfirmModal
        open={confirmDelete}
        danger
        title={`Delete ${p.fullName}’s record?`}
        body={`The record ${p.mrn} leaves the patients list. Its appointments, payments and receipts are kept. A record with upcoming bookings cannot be deleted, and when the hospital requires approval, an administrator decides first.`}
        confirmLabel="Delete record"
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
