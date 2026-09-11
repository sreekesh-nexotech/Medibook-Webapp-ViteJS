import type { ReactNode } from 'react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { cn } from '@/shared/lib/cn';
import { money } from '@/shared/lib/format';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Can } from '@/shared/ui/Can';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/ui/Icon';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TableShell, tdClass } from '@/shared/ui/TableShell';

import { hospitalPath, isHospitalRole } from '@/app/router/paths';

import { useAppointmentsStore } from '@/features/appointments/application/store/appointments.store';
import { grossAmount } from '@/features/appointments/application/store/appointments.logic';
import { usePatientsStore } from '@/features/patients/application/store/patients.store';

import { PatientModal } from '@/features/patients/presentation/components/PatientModal';

/**
 * Patient Detail (no medical data) — identity, contact, booking history and a
 * billing summary. Ported 1:1 from the design prototype's `PatientDetail`;
 * the selected MRN comes from the URL (`:mrn`), falling back to the first
 * record exactly like the prototype.
 */
export function PatientDetailScreen() {
  const navigate = useNavigate();
  const { role, mrn } = useParams();
  const hospitalRole = isHospitalRole(role) ? role : 'receptionist';

  const patients = usePatientsStore((s) => s.patients);
  const appts = useAppointmentsStore((s) => s.appts);
  const startBooking = useAppointmentsStore((s) => s.startBooking);

  const [edit, setEdit] = useState(false);

  const target = mrn ?? patients[0]?.mrn ?? appts[0]?.mrn;
  const rec = patients.find((x) => x.mrn === target);
  const list = appts.filter((a) => a.mrn === target);
  const base = rec ?? list[0] ?? appts[0];

  if (!base) {
    return (
      <Card pad={32}>
        <EmptyState
          icon="user-x"
          title="No patient selected."
          message="Pick a record from the patients list to see its contact details and booking history."
          actionLabel="Back to patients"
          onAction={() => navigate(hospitalPath(hospitalRole, 'patients'))}
        />
      </Card>
    );
  }

  const email = rec?.email ?? '';
  const address = rec?.address ?? '';
  // Billing figures are GST-inclusive, so they match what the receipts print.
  const sumGross = (state: string): number =>
    list.filter((a) => a.payment === state).reduce((s, a) => s + grossAmount(a), 0);
  const totalPaid = sumGross('Paid');
  const pending = sumGross('Pending');
  const waived = list.reduce((s, a) => s + (a.waivedAmount ?? 0), 0);
  const refunded = list.reduce((s, a) => s + (a.refundAmount ?? 0), 0);

  const infoRow = (k: string, v: ReactNode) => (
    <div className="border-border-soft flex justify-between border-b py-2.75">
      <span className="text-body text-text-muted">{k}</span>
      <span className="text-body text-text-strong text-right font-medium">{v}</span>
    </div>
  );

  const book = () => {
    startBooking(base.mrn);
    navigate(hospitalPath(hospitalRole, 'create'));
  };

  return (
    <div className="flex flex-col gap-5">
      <Card pad={22} className="flex items-center gap-5">
        <Avatar name={base.name} size={64} />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-h1 text-text-strong">{base.name}</span>
            <Badge status={base.status || 'Active'} />
          </div>
          <div className="text-body text-text-muted mt-1.25 flex flex-wrap gap-4">
            <span>MR: {base.mrn}</span>
            <span>·</span>
            <span>
              {base.age || '—'} yrs · {base.gender || '—'}
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1.25">
              <Icon name="phone" size={14} /> {base.phone || '—'}
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
      <div className="flex gap-5">
        <div className="flex flex-[2] flex-col gap-5">
          <Card>
            <SectionTitle size={16} className="mb-3.5">
              Booking History
            </SectionTitle>
            {list.length === 0 ? (
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
              <TableShell
                columns={['Date', 'Doctor / Dept', 'Source', 'Payment', 'Token', 'Status']}
              >
                {list.map((a) => (
                  <tr key={a.id}>
                    <td className={tdClass}>
                      {a.date}
                      <div className="text-caption text-text-muted">{a.time}</div>
                    </td>
                    <td className={tdClass}>
                      {a.doctor}
                      <div className="text-caption text-text-muted">{a.dept}</div>
                    </td>
                    <td className={tdClass}>
                      <Badge status={a.source} />
                    </td>
                    <td className={tdClass}>
                      <Badge status={a.payment} />
                    </td>
                    <td className={tdClass}>{a.token || '—'}</td>
                    <td className={tdClass}>
                      <Badge status={a.status} />
                    </td>
                  </tr>
                ))}
              </TableShell>
            )}
          </Card>
        </div>
        <div className="flex flex-1 flex-col gap-5">
          <Card>
            <SectionTitle size={16} className="mb-2">
              Contact Details
            </SectionTitle>
            {infoRow('Phone', base.phone || '—')}
            {infoRow('Email', email || '—')}
            {infoRow('Gender', base.gender || '—')}
            {infoRow('Age', (base.age || '—') + ' yrs')}
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
            {infoRow('Total Visits', list.length)}
            {infoRow('Total Paid', <span className="tabular-nums">{money(totalPaid)}</span>)}
            {infoRow(
              'Outstanding',
              <span className={cn('tabular-nums', pending ? 'text-d-500' : 'text-text-strong')}>
                {money(pending)}
              </span>,
            )}
            {waived > 0 &&
              infoRow('Fees Waived', <span className="tabular-nums">{money(waived)}</span>)}
            {refunded > 0 &&
              infoRow('Refunded', <span className="tabular-nums">{money(refunded)}</span>)}
            <div className="text-caption text-text-muted pt-2">
              Figures include 18% GST, as shown on the receipts.
            </div>
          </Card>
        </div>
      </div>
      <PatientModal open={edit} patient={rec ?? base} onClose={() => setEdit(false)} />
    </div>
  );
}
