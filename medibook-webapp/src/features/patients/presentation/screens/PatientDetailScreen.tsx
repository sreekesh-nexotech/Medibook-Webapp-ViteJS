import type { ReactNode } from 'react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { isFailure } from '@/core/error/failure';
import { cn } from '@/shared/lib/cn';
import { fmtDate, money } from '@/shared/lib/format';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Can } from '@/shared/ui/Can';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Icon } from '@/shared/ui/Icon';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SkeletonCards } from '@/shared/ui/Skeleton';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';

import { hospitalPath, isHospitalRole } from '@/app/router/paths';

import { useAppointmentsStore } from '@/features/appointments/application/store/appointments.store';
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
  appointmentSourceBadge,
  appointmentStatusBadge,
  displayPhone,
  formatAddress,
  formatTime,
  genderLabel,
  paiseToRupees,
  patientSourceBadge,
  paymentBadge,
} from '@/features/patients/presentation/components/patientsFormat';

/**
 * Patient Detail (no medical data) — identity, contact, booking history and a
 * billing summary. The MRN comes from the URL (`:mrn`) and is resolved to the
 * hospital's record through the API.
 */

const HISTORY_COLUMNS = ['Date', 'Doctor / Dept', 'Source', 'Payment', 'Token', 'Status'];
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

  // Booking still runs on the appointments store until H7 lands.
  const startBooking = useAppointmentsStore((s) => s.startBooking);

  const patientQuery = usePatientByMrnQuery(mrn);
  const rec = patientQuery.data;
  const historyQuery = usePatientAppointmentsQuery(rec?.id);

  const [edit, setEdit] = useState(false);
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
  const totalVisits = historyQuery.data?.total ?? 0;
  const age = ageFromDob(p.dateOfBirth);
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
    startBooking(p.mrn);
    navigate(hospitalPath(hospitalRole, 'create'));
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
          </div>
          <div className="text-body text-text-muted mt-1.25 flex flex-wrap gap-4">
            <span>MR: {p.mrn}</span>
            <span>·</span>
            <span>
              {age ?? '—'} yrs · {gender || '—'}
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1.25">
              <Icon name="phone" size={14} /> {phone || '—'}
            </span>
          </div>
        </div>
        <Can perm="Patients.edit">
          <Button variant="secondary" icon="pencil" onClick={() => setEdit(true)}>
            Edit
          </Button>
        </Can>
        <Can perm="Appointments.add">
          <Button icon="calendar-plus" onClick={book}>
            New Appointment
          </Button>
        </Can>
      </Card>
      {p.pendingChange && <PatientChangeNotice change={p.pendingChange} />}
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
                actionLabel="Book appointment"
                actionIcon="calendar-plus"
                onAction={book}
              />
            ) : (
              <TableShell columns={HISTORY_COLUMNS} state={historyState}>
                {list.map((a) => {
                  const src = appointmentSourceBadge(a.source);
                  const pay = paymentBadge(a.paymentStatus);
                  const st = appointmentStatusBadge(a.status);
                  return (
                    <tr key={a.id}>
                      <td className={tdClass}>
                        {fmtDate(a.scheduledDate)}
                        <div className="text-caption text-text-muted">
                          {formatTime(a.scheduledStartAt)}
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
                      <td className={tdClass}>{a.tokenLabel || '—'}</td>
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
            {infoRow('Age', (age ?? '—') + ' yrs')}
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
            {infoRow('Total Visits', historyQuery.isSuccess ? totalVisits : '—')}
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
              {totalVisits > list.length ? `, for the latest ${list.length} visits` : ''}.
            </div>
          </Card>
        </div>
      </div>
      <PatientModal open={edit} patient={p} onClose={() => setEdit(false)} />
    </div>
  );
}
