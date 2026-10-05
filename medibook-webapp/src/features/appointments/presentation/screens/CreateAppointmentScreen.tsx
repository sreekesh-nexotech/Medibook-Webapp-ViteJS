import { useDeferredValue, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { money } from '@/shared/lib/format';
import { phoneIN, required } from '@/shared/lib/validate';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Field } from '@/shared/ui/Field';
import { Form } from '@/shared/ui/Form';
import { Icon } from '@/shared/ui/Icon';
import { IconBtn } from '@/shared/ui/IconBtn';
import { InfoDot } from '@/shared/ui/InfoDot';
import { Select } from '@/shared/ui/Select';
import { Spinner } from '@/shared/ui/Spinner';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import { isFailure } from '@/core/error/failure';

import { hospitalPath, isHospitalRole, type HospitalRole } from '@/app/router/paths';

import type {
  DeskAppointment,
  NewWalkInPatient,
} from '@/features/appointments/domain/entities/appointments.entities';
import { useBookWalkInMutation } from '@/features/appointments/application/queries/appointments.mutations';
import { useAppointmentsStore } from '@/features/appointments/application/store/appointments.store';
import { AppointmentBookedModal } from '@/features/appointments/presentation/components/AppointmentBookedModal';
import { AppointmentSlotSelect } from '@/features/appointments/presentation/components/AppointmentSlotSelect';
import {
  localIso,
  toE164,
} from '@/features/appointments/presentation/components/appointments.view';
import { useDepartmentsQuery } from '@/features/doctors/application/queries/useDepartmentsQuery';
import { useDoctorsQuery } from '@/features/doctors/application/queries/useDoctorsQuery';
import { usePatientByMrnQuery } from '@/features/patients/application/queries/usePatientByMrnQuery';
import { usePatientsQuery } from '@/features/patients/application/queries/usePatientsQuery';
import type { PatientRecord } from '@/features/patients/domain/entities/patients.entities';

const GENDERS = ['Male', 'Female', 'Other'] as const;
type GenderLabel = (typeof GENDERS)[number];

const GENDER_VALUE: Readonly<Record<GenderLabel, NewWalkInPatient['gender']>> = {
  Male: 'male',
  Female: 'female',
  Other: 'other',
};

/** Native date-input styling — the design's `dateField`. */
const dateInputClass =
  'rounded-input border-border text-body text-text-strong h-13.5 w-full border bg-white px-4';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Patient search shows this many matches and starts at this many characters. */
const SEARCH_RESULTS = 6;
const SEARCH_MIN_CHARS = 2;

/** Error code when a slot was taken between picking and booking. */
const SLOT_UNAVAILABLE = 'SLOT_UNAVAILABLE';

/** Consultation-row id counter. */
let consultSeq = 1;
function nextConsultId(): number {
  consultSeq += 1;
  return consultSeq;
}

interface Consult {
  readonly id: number;
  readonly departmentId: string;
  readonly doctorId: string;
  readonly slotId: string;
}

/**
 * The flat fields of the booking. `hasPicked` rides along so the new-patient
 * validators stand down when an existing record is selected, keeping the
 * validator map at module level (and the error memo stable).
 */
interface BookingForm {
  iso: string;
  remark: string;
  firstName: string;
  lastName: string;
  phone: string;
  dob: string;
  gender: GenderLabel;
  hasPicked: boolean;
}

const VALIDATORS: FormValidators<BookingForm> = {
  iso: (value) => {
    const raw = value.trim();
    if (raw === '' || !ISO_DATE_PATTERN.test(raw)) return 'Pick a date for the appointment.';
    if (raw < localIso(new Date())) return 'The appointment date cannot be in the past.';
    return undefined;
  },
  firstName: (value, values) => (values.hasPicked ? undefined : required(value, 'First name')),
  phone: (value, values) => (values.hasPicked ? undefined : phoneIN(value)),
  dob: (value, values) =>
    values.hasPicked || value === '' || value <= localIso(new Date())
      ? undefined
      : 'Date of birth cannot be in the future.',
};

const CONSULT_HINT =
  'One consultation = one doctor, one slot, one token. Add more to book several doctors for the same patient in one visit — you collect for them together.';

function failureText(error: unknown, fallback: string): string {
  return isFailure(error) ? error.message : fallback;
}

/**
 * New walk-in appointment (design `Screens.jsx` `CreateAppointment`), booked
 * on the hospital API: pick or add the patient (H6), choose a date, and for
 * each consultation a department, a doctor and one of that doctor's open
 * slots (H5) — every walk-in consultation needs a slot (Q74). Online
 * bookings come from the Medibook app, not the desk. After booking, the fee
 * is collected and the receipts and token slips are issued.
 */
export function CreateAppointmentScreen() {
  const navigate = useNavigate();
  const roleParam = useParams().role;
  const role: HospitalRole = isHospitalRole(roleParam) ? roleParam : 'receptionist';
  const onDone = () => navigate(hospitalPath(role, 'appointments'));

  const departmentsQuery = useDepartmentsQuery();
  const doctorsQuery = useDoctorsQuery();
  const book = useBookWalkInMutation();

  /**
   * The MRN handed over by "Book Appointment" on the patients screens (client
   * state in the legacy store), captured once at mount and cleared below.
   */
  const bookMrn = useAppointmentsStore((s) => s.bookMrn);
  const consumeBooking = useAppointmentsStore((s) => s.consumeBooking);
  const [handoffMrn] = useState<string | null>(bookMrn);
  const handoff = usePatientByMrnQuery(handoffMrn ?? undefined);
  useEffect(() => {
    if (bookMrn) consumeBooking();
  }, [bookMrn, consumeBooking]);

  /** `undefined` = "use the hand-off patient, if any"; `null` = none picked. */
  const [selection, setSelection] = useState<PatientRecord | null | undefined>(undefined);
  const picked = selection === undefined ? (handoff.data ?? null) : selection;
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const deferredQ = useDeferredValue(q.trim());
  const search = usePatientsQuery({
    page: 1,
    pageSize: SEARCH_RESULTS,
    q: deferredQ,
    source: null,
    sortField: 'full_name',
    sortDirection: 'asc',
  });
  const matches = deferredQ.length >= SEARCH_MIN_CHARS ? (search.data?.items ?? []) : [];

  const [consults, setConsults] = useState<readonly Consult[]>([
    { id: 1, departmentId: '', doctorId: '', slotId: '' },
  ]);
  const [consultsTouched, setConsultsTouched] = useState(false);
  const [booked, setBooked] = useState<readonly DeskAppointment[] | null>(null);

  const form = useForm<BookingForm>({
    initial: {
      iso: localIso(new Date()),
      remark: '',
      firstName: '',
      lastName: '',
      phone: '',
      dob: '',
      gender: 'Male',
      hasPicked: false,
    },
    validate: VALIDATORS,
    onSubmit: async (v) => {
      if (ready.length === 0) return;
      try {
        const result = await book.mutateAsync({
          patient: picked
            ? { kind: 'existing', hospitalPatientId: picked.id }
            : {
                kind: 'new',
                patient: {
                  firstName: v.firstName.trim(),
                  lastName: v.lastName.trim(),
                  phone: toE164(v.phone),
                  gender: GENDER_VALUE[v.gender],
                  dateOfBirth: v.dob || null,
                },
              },
          consultations: ready.map((c) => ({
            departmentId: c.departmentId,
            doctorId: c.doctorId,
            slotId: c.slotId,
          })),
          remark: v.remark.trim(),
        });
        toast(
          `${result.appointments.length} appointment${result.appointments.length === 1 ? '' : 's'} booked`,
          'success',
        );
        setBooked(result.appointments);
      } catch (error) {
        toast(
          isFailure(error) && error.code === SLOT_UNAVAILABLE
            ? 'That slot was just taken — pick another time.'
            : failureText(error, 'Could not book the appointment.'),
          'error',
        );
      }
    },
  });

  // Keep the hidden validator flag in step with the patient choice.
  const hasPicked = picked !== null;
  if (form.values.hasPicked !== hasPicked) form.setField('hasPicked', hasPicked);

  const choosePatient = (p: PatientRecord): void => {
    setSelection(p);
    setQ('');
  };
  const clearPatient = (): void => setSelection(null);

  const departments = departmentsQuery.data ?? [];
  const doctors = doctorsQuery.data ?? [];
  const doctorsFor = (departmentId: string) =>
    doctors.filter((d) => d.departmentId === departmentId && d.status === 'active');

  const patch = (id: number, next: Partial<Consult>) =>
    setConsults((xs) => xs.map((c) => (c.id === id ? { ...c, ...next } : c)));
  const addConsult = () =>
    setConsults((xs) => [
      ...xs,
      { id: nextConsultId(), departmentId: '', doctorId: '', slotId: '' },
    ]);
  const removeConsult = (id: number) =>
    setConsults((xs) => (xs.length > 1 ? xs.filter((c) => c.id !== id) : xs));
  const setDate = (iso: string) => {
    form.setField('iso', iso);
    // Slots belong to a date; a new date needs new slots.
    setConsults((xs) => xs.map((c) => ({ ...c, slotId: '' })));
  };

  const ready = consults.filter((c) => c.departmentId && c.doctorId && c.slotId);
  const incomplete = consults.some((c) => (c.departmentId || c.doctorId) && !c.slotId);
  const consultsError =
    ready.length === 0
      ? 'Choose a department, a doctor and an open slot for at least one consultation.'
      : incomplete
        ? 'Finish or remove the consultation without a slot.'
        : undefined;
  const showConsultsError = consultsTouched ? consultsError : undefined;
  const feeTotal = ready.reduce(
    (sum, c) => sum + (doctors.find((d) => d.id === c.doctorId)?.feeRupees ?? 0),
    0,
  );
  const patientName = picked
    ? picked.fullName
    : `${form.values.firstName} ${form.values.lastName}`.trim();

  const submit = (): void => {
    setConsultsTouched(true);
    if (!picked && !adding) return; // the patient field says what is missing
    if (consultsError) return;
    form.handleSubmit();
  };

  const isCatalogueLoading = departmentsQuery.isPending || doctorsQuery.isPending;
  const catalogueError = departmentsQuery.error ?? doctorsQuery.error;

  return (
    <Form onSubmit={submit} className="flex max-w-250 flex-col gap-5">
      <Card pad={24}>
        <div className="border-border-soft mb-4.5 border-b pb-3">
          <h3 className="text-h3 text-text-navy m-0">Patient details</h3>
        </div>
        {handoffMrn && selection === undefined && handoff.isPending ? (
          <div className="text-text-muted flex justify-center py-4">
            <Spinner size={22} label="Loading the patient" />
          </div>
        ) : picked ? (
          <div className="bg-blue-soft-bg flex items-center gap-3.5 rounded-md px-4 py-3.5">
            <Avatar name={picked.fullName} size={40} />
            <div className="flex-1">
              <div className="text-body text-text-strong font-medium">{picked.fullName}</div>
              <div className="text-caption text-text-muted">
                {[picked.mrn, picked.gender, picked.phone].filter(Boolean).join(' · ')}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={clearPatient}>
              Change
            </Button>
          </div>
        ) : adding ? (
          <>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4.5">
              <Field label="First Name" required error={form.errorFor('firstName')}>
                <TextInput
                  value={form.values.firstName}
                  onChange={(v) => form.setField('firstName', v)}
                  onBlur={() => form.blurField('firstName')}
                  placeholder="First name"
                />
              </Field>
              <Field label="Last Name">
                <TextInput
                  value={form.values.lastName}
                  onChange={(v) => form.setField('lastName', v)}
                  placeholder="Last name"
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
              <Field label="Date of Birth" error={form.errorFor('dob')}>
                {(field) => (
                  <input
                    type="date"
                    id={field.id}
                    value={form.values.dob}
                    max={localIso(new Date())}
                    onChange={(e) => form.setField('dob', e.target.value)}
                    onBlur={() => form.blurField('dob')}
                    className={dateInputClass}
                  />
                )}
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
            <p className="text-caption text-text-muted mt-3">
              If this phone number already has a record here, the booking uses that record — no
              duplicate MRN is created.
            </p>
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
            <Field
              label="Patient"
              required
              error={consultsTouched && !picked ? 'Pick a patient or add a new one.' : undefined}
            >
              <div className="relative">
                <TextInput
                  value={q}
                  onChange={setQ}
                  placeholder="Search by name, phone number or MRN"
                  icon="search"
                />
                {deferredQ.length >= SEARCH_MIN_CHARS && (
                  <div className="border-border shadow-pop absolute top-14.5 right-0 left-0 z-20 overflow-hidden rounded-md border bg-white">
                    {search.isPending ? (
                      <div className="text-caption text-text-muted px-3.5 py-3">Searching…</div>
                    ) : search.isError ? (
                      <div className="text-caption text-danger px-3.5 py-3">
                        {failureText(search.error, 'Search failed.')}
                      </div>
                    ) : matches.length === 0 ? (
                      <div className="text-caption text-text-muted px-3.5 py-3">
                        No patient matches — add them as a new patient.
                      </div>
                    ) : (
                      matches.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => choosePatient(p)}
                          className="hover:bg-grey-200 flex w-full cursor-pointer items-center gap-3 px-3.5 py-2.75 text-left"
                        >
                          <Avatar name={p.fullName} size={30} />
                          <div className="flex-1">
                            <div className="text-body text-text-strong font-medium">
                              {p.fullName}
                            </div>
                            <div className="text-caption text-text-muted">
                              {[p.mrn, p.phone].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                        </button>
                      ))
                    )}
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
          <Field label="Date" required error={form.errorFor('iso')}>
            {(field) => (
              <input
                type="date"
                id={field.id}
                value={form.values.iso}
                min={localIso(new Date())}
                aria-describedby={field.describedById}
                aria-invalid={field.invalid || undefined}
                onChange={(e) => setDate(e.target.value)}
                onBlur={() => form.blurField('iso')}
                className={dateInputClass}
              />
            )}
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
          {isCatalogueLoading ? (
            <Spinner size={22} label="Loading departments and doctors" />
          ) : catalogueError ? (
            <span className="text-caption text-d-700 flex items-center gap-1.5">
              <Icon name="triangle-alert" size={13} />
              {failureText(catalogueError, 'Could not load departments and doctors.')}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  void departmentsQuery.refetch();
                  void doctorsQuery.refetch();
                }}
              >
                Retry
              </Button>
            </span>
          ) : (
            <div className="flex flex-col gap-3">
              {consults.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3">
                  <div className="flex-1">
                    <Select
                      value={departments.find((d) => d.id === c.departmentId)?.name ?? ''}
                      placeholder="Select Department"
                      options={departments.filter((d) => d.isActive).map((d) => d.name)}
                      onChange={(name) =>
                        patch(c.id, {
                          departmentId: departments.find((d) => d.name === name)?.id ?? '',
                          doctorId: '',
                          slotId: '',
                        })
                      }
                      aria-label={`Department for consultation ${i + 1}`}
                    />
                  </div>
                  <div className="flex-1">
                    <Select
                      value={doctors.find((d) => d.id === c.doctorId)?.name ?? ''}
                      placeholder={c.departmentId ? 'Select Doctor' : 'Select department first'}
                      options={doctorsFor(c.departmentId).map((d) => d.name)}
                      onChange={(name) =>
                        patch(c.id, {
                          doctorId:
                            doctorsFor(c.departmentId).find((d) => d.name === name)?.id ?? '',
                          slotId: '',
                        })
                      }
                      aria-label={`Doctor for consultation ${i + 1}`}
                    />
                  </div>
                  <div className="flex-1">
                    {c.doctorId ? (
                      <AppointmentSlotSelect
                        date={form.values.iso}
                        doctorId={c.doctorId}
                        value={c.slotId}
                        onChange={(slotId) => patch(c.id, { slotId })}
                        excluded={consults.filter((x) => x.id !== c.id).map((x) => x.slotId)}
                        ariaLabel={`Time for consultation ${i + 1}`}
                      />
                    ) : (
                      <Select
                        value=""
                        placeholder="Select doctor first"
                        options={[]}
                        onChange={() => undefined}
                        aria-label={`Time for consultation ${i + 1}`}
                      />
                    )}
                  </div>
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
          )}
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
            <div className="bg-bg-tint text-text-navy flex items-center justify-between px-3.5 py-2.5 font-medium">
              <span className="flex items-center gap-2">
                <Icon name="indian-rupee" size={16} className="text-text-muted" />
                {ready.length > 1 ? `${ready.length} consultations` : 'Consultation fee'} (before
                tax)
              </span>
              <span className="tabular-nums">{money(feeTotal)}</span>
            </div>
            <div className="text-caption text-text-muted px-3.5 py-2">
              Tax, any follow-up pricing and the final total are worked out by the booking and shown
              before you collect.
            </div>
          </div>
        )}
      </Card>
      <div className="flex justify-end gap-3.5">
        <Button variant="secondary" onClick={onDone} disabled={form.submitting}>
          Cancel
        </Button>
        <Button type="submit" icon="indian-rupee" busy={form.submitting}>
          Book & Collect Payment
        </Button>
      </div>
      <AppointmentBookedModal appointments={booked} patientName={patientName} onDone={onDone} />
    </Form>
  );
}
