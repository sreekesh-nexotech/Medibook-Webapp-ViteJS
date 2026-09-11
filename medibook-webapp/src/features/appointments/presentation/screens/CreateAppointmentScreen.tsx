import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { money } from '@/shared/lib/format';
import { phoneIN, positiveAmount, required } from '@/shared/lib/validate';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Field } from '@/shared/ui/Field';
import { Form } from '@/shared/ui/Form';
import { Icon } from '@/shared/ui/Icon';
import { IconBtn } from '@/shared/ui/IconBtn';
import { InfoDot } from '@/shared/ui/InfoDot';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';

import { hospitalPath, isHospitalRole, type HospitalRole } from '@/app/router/paths';

import { useAppointmentsStore } from '@/features/appointments/application/store/appointments.store';
import {
  GST_LABEL,
  isoToRelLocal,
  isPastISO,
  taxBreakdown,
  todayISO,
} from '@/features/appointments/application/store/appointments.logic';
import {
  DEPARTMENTS,
  DOCTORS,
  FEES,
} from '@/features/appointments/application/store/appointments.types';
import type {
  Appointment,
  Gender,
} from '@/features/appointments/application/store/appointments.types';
import { DoctorCapacityHint } from '@/features/appointments/presentation/components/DoctorCapacityHint';
import { MultiPaymentModal } from '@/features/appointments/presentation/components/MultiPaymentModal';
import { MultiReceiptModal } from '@/features/appointments/presentation/components/MultiReceiptModal';
import { usePatientsStore } from '@/features/patients/application/store/patients.store';
import type { Patient } from '@/features/patients/application/store/patients.types';

const TIME_SLOTS = [
  '9:00 am',
  '9:30 am',
  '10:00 am',
  '10:30 am',
  '11:00 am',
  '11:30 am',
  '12:00 pm',
  '2:00 pm',
  '3:00 pm',
  '4:00 pm',
];

const GENDERS: readonly Gender[] = ['Male', 'Female', 'Other'];

/** Native date-input styling — the design's `dateField`. */
const dateInputClass =
  'rounded-input border-border text-body text-text-strong h-13.5 w-full border bg-white px-4';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Oldest age the desk can type before it is obviously a typo. */
const MAX_AGE = 120;

/** Consultation-row id counter — replaces the design's `Date.now()` id mint. */
let consultSeq = 1;
function nextConsultId(): number {
  consultSeq += 1;
  return consultSeq;
}

interface Consult {
  id: number;
  dept: string;
  doctor: string;
}

interface MultiTarget {
  patient: string;
  appts: Appointment[];
}

/**
 * The flat fields of the booking. `hasPicked` rides along so the new-patient
 * validators can stand down when an existing record is selected, which keeps
 * the validator map at module level (and therefore the error memo stable).
 */
interface BookingForm {
  apptType: string;
  iso: string;
  time: string;
  remark: string;
  name: string;
  phone: string;
  age: string;
  gender: Gender;
  mrn: string;
  hasPicked: boolean;
}

const VALIDATORS: FormValidators<BookingForm> = {
  iso: (value) => {
    const raw = value.trim();
    if (raw === '') return 'Pick a date for the appointment.';
    if (!ISO_DATE_PATTERN.test(raw)) return 'Enter a valid date.';
    if (Number.isNaN(new Date(`${raw}T00:00:00`).getTime())) return 'Enter a valid date.';
    if (isPastISO(raw)) return 'The appointment date cannot be in the past.';
    return undefined;
  },
  time: (value) =>
    TIME_SLOTS.includes(value) ? undefined : 'Pick an appointment time from the list.',
  name: (value, values) => (values.hasPicked ? undefined : required(value, 'Patient name')),
  phone: (value, values) => (values.hasPicked ? undefined : phoneIN(value)),
  age: (value, values) => {
    if (values.hasPicked || value.trim() === '') return undefined;
    const invalid = positiveAmount(value, 'Age');
    if (invalid) return invalid;
    return Number(value) <= MAX_AGE ? undefined : `Age must be ${MAX_AGE} or less.`;
  },
};

const APPT_TYPE_HINT =
  'Walk-in = booked at the desk (collect payment & issue token now, even for a future date). Online = booked & prepaid via the Medibook app.';
const CONSULT_HINT =
  'One consultation = one doctor, one fee, one token. Add more to book several doctors for the same patient in a single visit — you collect one combined payment.';

/** Create Appointment — patient search/add, multi-consultation, walk-in vs online (design `Screens.jsx` `CreateAppointment`). */
export function CreateAppointmentScreen() {
  const navigate = useNavigate();
  const roleParam = useParams().role;
  const role: HospitalRole = isHospitalRole(roleParam) ? roleParam : 'receptionist';
  const onDone = () => navigate(hospitalPath(role, 'appointments'));

  const create = useAppointmentsStore((s) => s.create);
  const consumeBooking = useAppointmentsStore((s) => s.consumeBooking);
  const storePatients = usePatientsStore((s) => s.patients);

  /**
   * The MRN handed over by "Book Appointment" on the patients screens. Read
   * during render (a pure store read) so it can seed the form, captured once at
   * mount, and cleared in the effect below so returning here later starts
   * blank. No prop-to-state effect, so nothing to synchronise.
   */
  const bookMrn = useAppointmentsStore((s) => s.bookMrn);
  const [bookedPatient] = useState<Patient | null>(() =>
    bookMrn ? (usePatientsStore.getState().patients.find((p) => p.mrn === bookMrn) ?? null) : null,
  );

  const [picked, setPicked] = useState<Patient | null>(bookedPatient);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [consults, setConsults] = useState<Consult[]>([{ id: 1, dept: '', doctor: '' }]);
  const [consultsTouched, setConsultsTouched] = useState(false);
  const [multiPay, setMultiPay] = useState<MultiTarget | null>(null);
  const [multiReceipt, setMultiReceipt] = useState<MultiTarget | null>(null);

  /**
   * The date defect (audit 4.5): this used to seed `relToISO('Today')`, which
   * converts LOCAL midnight to UTC and so returns **yesterday** in IST — the
   * form opened on a past date, the appointment was saved as "10 Sep" instead
   * of "Today", and a walk-in's token was issued into a queue nobody could
   * see. `todayISO()` builds the string from local date parts instead.
   */
  const form = useForm<BookingForm>({
    initial: {
      apptType: 'Walk-in',
      iso: todayISO(),
      time: '10:00 am',
      remark: '',
      name: bookedPatient?.name ?? '',
      phone: bookedPatient?.phone ?? '',
      age: bookedPatient ? String(bookedPatient.age) : '',
      gender: bookedPatient?.gender ?? 'Male',
      mrn: bookedPatient?.mrn ?? '',
      hasPicked: bookedPatient != null,
    },
    validate: VALIDATORS,
    onSubmit: (v) => {
      // The consultation rows are a list, not a field, so they sit outside
      // `useForm`. Their inline error is rendered next to them and the save
      // stops here — never save a booking with nothing booked.
      if (ready.length === 0) return;
      const base = picked
        ? {
            mrn: picked.mrn,
            name: picked.name,
            age: picked.age,
            gender: picked.gender,
            phone: picked.phone,
            email: picked.email,
            address: picked.address,
          }
        : {
            mrn: v.mrn,
            name: v.name,
            age: Number(v.age) || 0,
            gender: v.gender,
            phone: v.phone,
          };
      const dateLabel = isoToRelLocal(v.iso);
      const created: Appointment[] = [];
      ready.forEach((c) => {
        const dept = DEPARTMENTS.find((x) => x === c.dept);
        if (!dept) return;
        created.push(
          create({
            ...base,
            dept,
            doctor: c.doctor,
            date: dateLabel,
            time: v.time,
            remark: v.remark,
            source,
          }),
        );
      });
      if (source === 'Walk-in') setMultiPay({ patient: patientName, appts: created });
      else onDone();
    },
  });

  // Clear the hand-off now that this screen has read it. A store write, not a
  // setState, so there is no cascading render to synchronise.
  useEffect(() => {
    if (bookMrn) consumeBooking();
  }, [bookMrn, consumeBooking]);

  const source = form.values.apptType === 'Online' ? 'Online' : 'Walk-in';

  const choosePatient = (p: Patient): void => {
    setPicked(p);
    form.setValues({
      hasPicked: true,
      name: p.name,
      phone: p.phone,
      age: String(p.age),
      gender: p.gender,
      mrn: p.mrn,
    });
    setQ('');
  };
  const clearPatient = (): void => {
    setPicked(null);
    // Clear the identity fields too, so an unfinished "Change" cannot book the
    // previous patient's details under their MRN.
    form.setValues({ hasPicked: false, name: '', phone: '', age: '', mrn: '' });
  };

  const setConsultDept = (id: number, dept: string) =>
    setConsults((xs) => xs.map((c) => (c.id === id ? { ...c, dept, doctor: '' } : c)));
  const setConsultDoctor = (id: number, doctor: string) =>
    setConsults((xs) => xs.map((c) => (c.id === id ? { ...c, doctor } : c)));
  const addConsult = () =>
    setConsults((xs) => [...xs, { id: nextConsultId(), dept: '', doctor: '' }]);
  const removeConsult = (id: number) =>
    setConsults((xs) => (xs.length > 1 ? xs.filter((c) => c.id !== id) : xs));

  const doctorsFor = (dept: string): readonly string[] => {
    const d = DEPARTMENTS.find((x) => x === dept);
    return d ? DOCTORS[d] : [];
  };
  const feeOf = (dept: string): number => {
    const d = DEPARTMENTS.find((x) => x === dept);
    return d ? FEES[d] : 0;
  };

  const matches = q
    ? storePatients
        .filter((p) =>
          ((p.name || '') + ' ' + (p.phone || '') + ' ' + p.mrn)
            .toLowerCase()
            .includes(q.toLowerCase()),
        )
        .slice(0, 6)
    : [];
  const ready = consults.filter((c) => c.dept && c.doctor);
  const consultsError =
    ready.length === 0
      ? 'Choose a department and a doctor for at least one consultation.'
      : undefined;
  const showConsultsError = consultsTouched ? consultsError : undefined;
  const tax = taxBreakdown(ready.reduce((s, c) => s + feeOf(c.dept), 0));
  const patientName = picked ? picked.name : form.values.name;

  /**
   * One submit path for Enter and for the footer button. Every failure is an
   * inline message on the field that is wrong (audit 3.5.1/3.5.2) — there is
   * no toast to miss.
   */
  const submit = (): void => {
    setConsultsTouched(true);
    form.handleSubmit();
  };

  return (
    <Form onSubmit={submit} className="flex max-w-250 flex-col gap-5">
      <Card pad={24}>
        <div className="border-border-soft mb-4.5 border-b pb-3">
          <h3 className="text-h3 text-text-navy m-0">Patient details</h3>
        </div>
        {picked ? (
          <div className="bg-blue-soft-bg flex items-center gap-3.5 rounded-md px-4 py-3.5">
            <Avatar name={picked.name} size={40} />
            <div className="flex-1">
              <div className="text-body text-text-strong font-medium">{picked.name}</div>
              <div className="text-caption text-text-muted">
                {picked.mrn} · {picked.age} yrs · {picked.gender} · {picked.phone}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={clearPatient}>
              Change
            </Button>
          </div>
        ) : adding ? (
          <>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4.5">
              <Field label="Full Name" required error={form.errorFor('name')}>
                <TextInput
                  value={form.values.name}
                  onChange={(v) => form.setField('name', v)}
                  onBlur={() => form.blurField('name')}
                  placeholder="Patient name"
                />
              </Field>
              <Field label="Phone Number" required error={form.errorFor('phone')}>
                <TextInput
                  value={form.values.phone}
                  onChange={(v) => form.setField('phone', v)}
                  onBlur={() => form.blurField('phone')}
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={10}
                  placeholder="10-digit mobile"
                />
              </Field>
              <Field label="Age" error={form.errorFor('age')}>
                <TextInput
                  value={form.values.age}
                  onChange={(v) => form.setField('age', v)}
                  onBlur={() => form.blurField('age')}
                  inputMode="numeric"
                  placeholder="Age"
                />
              </Field>
              <Field label="Gender">
                <Select
                  value={form.values.gender}
                  options={GENDERS}
                  onChange={(v) => {
                    const g = GENDERS.find((x) => x === v);
                    if (g) form.setField('gender', g);
                  }}
                />
              </Field>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon="arrow-left"
              className="mt-3.5"
              onClick={() => setAdding(false)}
            >
              Back to search
            </Button>
          </>
        ) : (
          <>
            <Field label="Patient" required error={form.errorFor('name')}>
              <div className="relative">
                <TextInput
                  value={q}
                  onChange={setQ}
                  placeholder="Search by name, phone number or MRN"
                  icon="search"
                />
                {matches.length > 0 && (
                  <div className="border-border shadow-pop absolute top-14.5 right-0 left-0 z-20 overflow-hidden rounded-md border bg-white">
                    {matches.map((p) => (
                      <button
                        key={p.mrn}
                        type="button"
                        onClick={() => choosePatient(p)}
                        className="hover:bg-grey-200 flex w-full cursor-pointer items-center gap-3 px-3.5 py-2.75 text-left"
                      >
                        <Avatar name={p.name} size={30} />
                        <div className="flex-1">
                          <div className="text-body text-text-strong font-medium">{p.name}</div>
                          <div className="text-caption text-text-muted">
                            {p.mrn} · {p.phone}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Field>
            <Button
              variant="secondary"
              icon="plus"
              className="mt-3.5"
              onClick={() => setAdding(true)}
            >
              Add new patient
            </Button>
          </>
        )}
      </Card>
      <Card pad={24}>
        <div className="border-border-soft mb-4.5 border-b pb-3">
          <h3 className="text-h3 text-text-navy m-0">Appointment Information</h3>
        </div>
        <div className="grid grid-cols-3 gap-x-6 gap-y-5">
          <Field label="Appointment type">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Select
                  value={form.values.apptType}
                  options={['Walk-in', 'Online']}
                  onChange={(v) => form.setField('apptType', v)}
                />
              </div>
              <InfoDot text={APPT_TYPE_HINT} />
            </div>
          </Field>
          <Field label="Date" required error={form.errorFor('iso')}>
            {(field) => (
              <input
                type="date"
                id={field.id}
                value={form.values.iso}
                min={todayISO()}
                aria-describedby={field.describedById}
                aria-invalid={field.invalid || undefined}
                onChange={(e) => form.setField('iso', e.target.value)}
                onBlur={() => form.blurField('iso')}
                className={dateInputClass}
              />
            )}
          </Field>
          <Field label="Appointment time" required error={form.errorFor('time')}>
            <Select
              value={form.values.time}
              options={TIME_SLOTS}
              onChange={(v) => form.setField('time', v)}
              onBlur={() => form.blurField('time')}
            />
          </Field>
        </div>
        <div className="mt-5.5">
          <div className="mb-2.5 flex items-center gap-2">
            <span className="font-ui text-label text-text-strong">
              Consultations
              <span className="text-d-500"> *</span>
            </span>
            <InfoDot text={CONSULT_HINT} />
          </div>
          <div className="flex flex-col gap-3">
            {consults.map((c, i) => (
              <div key={c.id} className="grid grid-cols-[1fr_1fr_auto] items-center gap-3">
                <Select
                  value={c.dept}
                  placeholder="Select Department"
                  options={DEPARTMENTS}
                  onChange={(v) => setConsultDept(c.id, v)}
                  aria-label={`Department for consultation ${i + 1}`}
                />
                <Select
                  value={c.doctor}
                  placeholder={c.dept ? 'Select Doctor' : 'Select department first'}
                  options={doctorsFor(c.dept)}
                  onChange={(v) => setConsultDoctor(c.id, v)}
                  aria-label={`Doctor for consultation ${i + 1}`}
                />
                {consults.length > 1 ? (
                  <IconBtn
                    name="trash-2"
                    label="Remove consultation"
                    box={54}
                    color="var(--color-d-500)"
                    onClick={() => removeConsult(c.id)}
                  />
                ) : (
                  <span className="w-13.5"></span>
                )}
              </div>
            ))}
          </div>
          {showConsultsError && (
            <span className="text-caption text-d-700 mt-2 flex items-center gap-1.5">
              <Icon name="triangle-alert" size={13} /> {showConsultsError}
            </span>
          )}
          <Button variant="ghost" size="sm" icon="plus" className="mt-2.5" onClick={addConsult}>
            Add another consultation
          </Button>
        </div>
        <div className="mt-4.5">
          <Field label="Note (Optional)">
            {(field) => (
              <textarea
                id={field.id}
                value={form.values.remark}
                onChange={(e) => form.setField('remark', e.target.value)}
                placeholder="Add any relevant notes..."
                className="rounded-input border-border text-body-lg text-text-strong h-23 w-full resize-none border p-3.5"
              ></textarea>
            )}
          </Field>
        </div>
        {ready.length > 0 && (
          <div className="border-border-soft text-body mt-4 overflow-hidden rounded-md border">
            <div className="text-text-body flex items-center justify-between px-3.5 py-2.5">
              <span className="flex items-center gap-2">
                <Icon name="indian-rupee" size={16} className="text-text-muted" />
                {ready.length > 1 ? `${ready.length} consultations` : 'Consultation fee'}
              </span>
              <span className="tabular-nums">{money(tax.subtotal)}</span>
            </div>
            <div className="text-text-body border-border-soft flex items-center justify-between border-t px-3.5 py-2.5">
              <span>{GST_LABEL}</span>
              <span className="tabular-nums">{money(tax.gst)}</span>
            </div>
            <div className="bg-bg-tint text-text-navy flex items-center justify-between px-3.5 py-2.5 font-medium">
              <span className="flex items-center gap-2">
                Total payable
                {source === 'Online' && <Badge status="Paid">Prepaid online</Badge>}
              </span>
              <span className="tabular-nums">{money(tax.total)}</span>
            </div>
          </div>
        )}
        {ready.map((c) => (
          <DoctorCapacityHint key={c.id} doctor={c.doctor} />
        ))}
      </Card>
      <div className="flex justify-end gap-3.5">
        <Button variant="secondary" onClick={onDone} disabled={form.submitting}>
          Cancel
        </Button>
        <Button
          type="submit"
          icon={source === 'Walk-in' ? 'indian-rupee' : 'check'}
          busy={form.submitting}
        >
          {source === 'Walk-in'
            ? 'Save & Record Payment'
            : ready.length > 1
              ? 'Create Appointments'
              : 'Create Appointment'}
        </Button>
      </div>
      <MultiPaymentModal
        open={!!multiPay}
        patient={multiPay?.patient}
        appts={multiPay?.appts ?? null}
        onClose={() => {
          setMultiPay(null);
          onDone();
        }}
        onPaid={(updated) => {
          setMultiPay(null);
          setMultiReceipt({ patient: patientName, appts: updated });
        }}
      />
      <MultiReceiptModal
        open={!!multiReceipt}
        patient={multiReceipt?.patient}
        appts={multiReceipt?.appts ?? null}
        onClose={() => {
          setMultiReceipt(null);
          onDone();
        }}
      />
    </Form>
  );
}
