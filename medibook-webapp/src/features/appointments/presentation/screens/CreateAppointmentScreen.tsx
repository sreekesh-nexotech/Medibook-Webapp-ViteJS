import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { useActionKeys } from '@/shared/hooks/useActionKeys';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { useHospitalToday } from '@/shared/hooks/useHospitalTime';
import { useCan } from '@/shared/hooks/usePermission';
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

import {
  BOOK_FOR_MRN_PARAM,
  hospitalPath,
  isHospitalRole,
  type HospitalRole,
} from '@/app/router/paths';

import type {
  DeskAppointment,
  NewWalkInPatient,
  QuoteInput,
} from '@/features/appointments/domain/entities/appointments.entities';
import { useBookWalkInMutation } from '@/features/appointments/application/queries/appointments.mutations';
import { useWalkInQuoteQuery } from '@/features/appointments/application/queries/appointments.queries';
import { AppointmentBookedModal } from '@/features/appointments/presentation/components/AppointmentBookedModal';
import { AppointmentSlotSelect } from '@/features/appointments/presentation/components/AppointmentSlotSelect';
import { PatientSearchResults } from '@/features/appointments/presentation/components/PatientSearchResults';
import {
  deskErrorText,
  isSlotRefusal,
  toE164,
} from '@/features/appointments/presentation/components/appointments.view';
import {
  servicesForDoctor,
  uniqueLabels,
} from '@/features/appointments/presentation/components/createAppointment.view';
import { useDepartmentsQuery } from '@/features/doctors/application/queries/useDepartmentsQuery';
import { useDoctorsQuery } from '@/features/doctors/application/queries/useDoctorsQuery';
import { usePatientByMrnQuery } from '@/features/patients/application/queries/usePatientByMrnQuery';
import type { PatientRecord } from '@/features/patients/domain/entities/patients.entities';
import {
  useDoctorServicesQuery,
  useServicesQuery,
} from '@/features/settings/application/queries/services.queries';

/**
 * Gender starts unset, so a desk that skips the field records nothing
 * rather than a wrong value; "Prefer not to say" is the backend's
 * `undisclosed`.
 */
const GENDERS = ['Not specified', 'Male', 'Female', 'Other', 'Prefer not to say'] as const;
type GenderLabel = (typeof GENDERS)[number];

const GENDER_VALUE: Readonly<Record<GenderLabel, NewWalkInPatient['gender']>> = {
  'Not specified': null,
  Male: 'male',
  Female: 'female',
  Other: 'other',
  'Prefer not to say': 'undisclosed',
};

/** A stored patient's gender code as the desk reads it. */
const GENDER_DISPLAY: Readonly<Record<string, string>> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
  undisclosed: 'Gender not disclosed',
};

/** Desk phones are Indian mobiles; show them without the country code. */
const INDIA_PREFIX = '+91';

function displayPhone(e164: string | null): string | null {
  if (!e164) return null;
  return e164.startsWith(INDIA_PREFIX) ? e164.slice(INDIA_PREFIX.length) : e164;
}

/** Native date-input styling — the design's `dateField`. */
const dateInputClass =
  'rounded-input border-border text-body text-text-strong h-13.5 w-full border bg-white px-4';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Patient search starts at this many characters, once typing pauses. */
const SEARCH_MIN_CHARS = 2;
const SEARCH_DEBOUNCE_MS = 300;

/** The backend's limits (`HospitalWalkInSerializer`): names, remark, consultations per visit. */
const NAME_MAX = 100;
const REMARK_MAX = 2000;
const MAX_CONSULTATIONS = 10;

/** One booking per form submit, replayed (not repeated) on retry (UAT-16). */
const BOOK_ACTION = 'book';

const NO_SERVICE = 'Consultation only';

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
  readonly serviceId: string;
}

/**
 * The flat fields of the booking. `hasPicked` and `today` ride along so the
 * validators stay at module level (and the error memo stable): the
 * new-patient fields stand down when an existing record is picked, and the
 * date checks use the hospital's own day (UAT-47).
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
  today: string;
}

const VALIDATORS: FormValidators<BookingForm> = {
  iso: (value, values) => {
    const raw = value.trim();
    if (raw === '' || !ISO_DATE_PATTERN.test(raw)) return 'Pick a date for the appointment.';
    if (raw < values.today) return 'The appointment date cannot be in the past.';
    return undefined;
  },
  firstName: (value, values) => (values.hasPicked ? undefined : required(value, 'First name')),
  phone: (value, values) => (values.hasPicked ? undefined : phoneIN(value)),
  dob: (value, values) =>
    values.hasPicked || value === '' || value <= values.today
      ? undefined
      : 'Date of birth cannot be in the future.',
};

const CONSULT_HINT =
  'One consultation = one doctor, one slot, one token. Add more to book several doctors for the same patient in one visit — each gets its own receipt.';

function failureText(error: unknown, fallback: string): string {
  return isFailure(error) ? deskErrorText(error, fallback) : fallback;
}

/**
 * New walk-in appointment (design `Screens.jsx` `CreateAppointment`), booked
 * on the hospital API: pick or add the patient (H6), choose a date, and for
 * each consultation a department, a doctor, one of that doctor's open slots
 * (H5, Q74) and optionally a service. The fee shown is the backend's own
 * quote (APPT-05) when it can give one. Staff who take payments collect
 * straight after booking; a role without payments books and sends the
 * patient to reception (UAT-45). One `Idempotency-Key` covers every retry of
 * one booking (UAT-16).
 */
export function CreateAppointmentScreen() {
  const navigate = useNavigate();
  const roleParam = useParams().role;
  const role: HospitalRole = isHospitalRole(roleParam) ? roleParam : 'receptionist';
  const onDone = () => navigate(hospitalPath(role, 'appointments'));
  const { today, timeZone } = useHospitalToday();
  const canCollect = useCan('Payments.add');

  const departmentsQuery = useDepartmentsQuery();
  const doctorsQuery = useDoctorsQuery();
  const servicesQuery = useServicesQuery();
  const doctorServicesQuery = useDoctorServicesQuery();
  const book = useBookWalkInMutation();
  const actionKeys = useActionKeys();

  /** The MRN handed over by "Book Appointment" on the patients screens (`?mrn=`). */
  const [searchParams] = useSearchParams();
  const handoffMrn = searchParams.get(BOOK_FOR_MRN_PARAM);
  const handoff = usePatientByMrnQuery(handoffMrn ?? undefined);

  /** `undefined` = "use the hand-off patient, if any"; `null` = none picked. */
  const [selection, setSelection] = useState<PatientRecord | null | undefined>(undefined);
  const picked = selection === undefined ? (handoff.data ?? null) : selection;
  const handoffFailed =
    Boolean(handoffMrn) && selection === undefined && !handoff.isPending && !handoff.data;
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const deferredQ = useDebouncedValue(q.trim(), SEARCH_DEBOUNCE_MS);

  const [consults, setConsults] = useState<readonly Consult[]>([
    { id: 1, departmentId: '', doctorId: '', slotId: '', serviceId: '' },
  ]);
  const [consultsTouched, setConsultsTouched] = useState(false);
  const [booked, setBooked] = useState<{
    readonly visitId: string;
    readonly appointments: readonly DeskAppointment[];
  } | null>(null);

  const form = useForm<BookingForm>({
    initial: {
      iso: today,
      remark: '',
      firstName: '',
      lastName: '',
      phone: '',
      dob: '',
      gender: 'Not specified',
      hasPicked: false,
      today,
    },
    validate: VALIDATORS,
    onSubmit: async (v) => {
      if (ready.length === 0) return;
      try {
        const result = await book.mutateAsync({
          idempotencyKey: actionKeys.keyFor(BOOK_ACTION),
          input: {
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
              serviceId: c.serviceId || null,
            })),
            remark: v.remark.trim(),
          },
        });
        actionKeys.settle(BOOK_ACTION);
        toast(
          `${result.appointments.length} appointment${result.appointments.length === 1 ? '' : 's'} booked`,
          'success',
        );
        setBooked({ visitId: result.visitId, appointments: result.appointments });
      } catch (error) {
        // A refused slot leaves the picker (the slot lists refresh): drop the
        // choice so the desk picks again.
        if (isFailure(error) && isSlotRefusal(error)) {
          const index = error.meta.index;
          const refused = typeof index === 'number' ? ready[index] : undefined;
          setConsults((xs) =>
            xs.map((c) =>
              refused === undefined || c.id === refused.id ? { ...c, slotId: '' } : c,
            ),
          );
        }
        toast(failureText(error, 'Could not book the appointment.'), 'error');
      }
    },
  });

  // Keep the hidden validator flags in step with the patient choice and the day.
  const hasPicked = picked !== null;
  if (form.values.hasPicked !== hasPicked) form.setField('hasPicked', hasPicked);
  if (form.values.today !== today) form.setField('today', today);

  const choosePatient = (p: PatientRecord): void => {
    setSelection(p);
    setQ('');
  };
  const clearPatient = (): void => setSelection(null);

  const departments = useMemo(() => departmentsQuery.data ?? [], [departmentsQuery.data]);
  const doctors = useMemo(() => doctorsQuery.data ?? [], [doctorsQuery.data]);
  const doctorsFor = (departmentId: string) =>
    doctors.filter((d) => d.departmentId === departmentId && d.status === 'active');
  const activeDepartments = departments.filter((d) => d.isActive);
  const departmentLabels = uniqueLabels(
    activeDepartments,
    (d) => d.name,
    (d) => d.code,
  );

  const patch = (id: number, next: Partial<Consult>) =>
    setConsults((xs) => xs.map((c) => (c.id === id ? { ...c, ...next } : c)));
  const addConsult = () =>
    setConsults((xs) =>
      xs.length >= MAX_CONSULTATIONS
        ? xs
        : [
            ...xs,
            { id: nextConsultId(), departmentId: '', doctorId: '', slotId: '', serviceId: '' },
          ],
    );
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

  // The backend's quote (APPT-05): follow-up pricing, service and tax, exactly
  // as booking would snapshot them. Falls back to the doctors' list fees when
  // the backend cannot quote.
  const priced = consults.filter((c) => c.doctorId);
  const quoteInput: QuoteInput | null =
    priced.length > 0 && ISO_DATE_PATTERN.test(form.values.iso)
      ? {
          hospitalPatientId: picked?.id ?? null,
          consultations: priced.map((c) => ({
            doctorId: c.doctorId,
            slotId: c.slotId || null,
            serviceId: c.serviceId || null,
            date: form.values.iso,
          })),
        }
      : null;
  const quote = useWalkInQuoteQuery(quoteInput);
  const pricedDoctors = priced.map((c) => doctors.find((d) => d.id === c.doctorId));
  const feeTotal = pricedDoctors.reduce((sum, d) => sum + (d?.feeRupees ?? 0), 0);
  const followUpTotal = pricedDoctors.reduce(
    (sum, d) => sum + (d?.followUpFeeRupees ?? d?.feeRupees ?? 0),
    0,
  );
  const quoted = quote.data && !quote.isPlaceholderData ? quote.data : null;

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
  const servicesAvailable = servicesQuery.isSuccess && doctorServicesQuery.isSuccess;

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
                {[
                  picked.mrn,
                  picked.gender ? (GENDER_DISPLAY[picked.gender] ?? picked.gender) : null,
                  displayPhone(picked.phone),
                ]
                  .filter(Boolean)
                  .join(' · ')}
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
                  maxLength={NAME_MAX}
                  placeholder="First name"
                />
              </Field>
              <Field label="Last Name">
                <TextInput
                  value={form.values.lastName}
                  onChange={(v) => form.setField('lastName', v)}
                  maxLength={NAME_MAX}
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
                    max={today}
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
              If this phone number belongs to a patient already registered here with the same name,
              that record and MR number are used; otherwise a new record is created.
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
            {handoffFailed && (
              <div className="text-caption text-d-700 mb-3 flex items-center gap-1.5">
                <Icon name="triangle-alert" size={13} />
                No patient with MR number {handoffMrn} could be opened. Search for them or add them
                as a new patient.
              </div>
            )}
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
                  <PatientSearchResults query={deferredQ} onPick={choosePatient} />
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
                min={today}
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
              {consults.map((c, i) => {
                const deptDoctors = doctorsFor(c.departmentId);
                const doctorLabels = uniqueLabels(
                  deptDoctors,
                  (d) => d.name,
                  (d) => (d.room ? `Room ${d.room}` : d.slug),
                );
                const services = servicesAvailable
                  ? servicesForDoctor(
                      c.doctorId,
                      servicesQuery.data ?? [],
                      doctorServicesQuery.data ?? [],
                    )
                  : [];
                const serviceLabel = (s: (typeof services)[number]) =>
                  `${s.name} · ${money(s.priceRupees)}`;
                const chosenService = services.find((s) => s.id === c.serviceId);
                return (
                  <div key={c.id} className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <Select
                          value={departmentLabels.get(c.departmentId) ?? ''}
                          placeholder="Select Department"
                          options={activeDepartments.map(
                            (d) => departmentLabels.get(d.id) ?? d.name,
                          )}
                          onChange={(label) =>
                            patch(c.id, {
                              departmentId:
                                activeDepartments.find((d) => departmentLabels.get(d.id) === label)
                                  ?.id ?? '',
                              doctorId: '',
                              slotId: '',
                              serviceId: '',
                            })
                          }
                          aria-label={`Department for consultation ${i + 1}`}
                        />
                      </div>
                      <div className="flex-1">
                        <Select
                          value={doctorLabels.get(c.doctorId) ?? ''}
                          placeholder={c.departmentId ? 'Select Doctor' : 'Select department first'}
                          options={deptDoctors.map((d) => doctorLabels.get(d.id) ?? d.name)}
                          onChange={(label) =>
                            patch(c.id, {
                              doctorId:
                                deptDoctors.find((d) => doctorLabels.get(d.id) === label)?.id ?? '',
                              slotId: '',
                              serviceId: '',
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
                            timeZone={timeZone}
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
                    {c.doctorId && services.length > 0 && (
                      <div className="flex items-center gap-3 pr-16.5">
                        <span className="text-caption text-text-muted w-24 flex-none">Service</span>
                        <div className="flex-1">
                          <Select
                            value={chosenService ? serviceLabel(chosenService) : NO_SERVICE}
                            options={[NO_SERVICE, ...services.map(serviceLabel)]}
                            onChange={(label) =>
                              patch(c.id, {
                                serviceId:
                                  services.find((s) => serviceLabel(s) === label)?.id ?? '',
                              })
                            }
                            height={44}
                            aria-label={`Service for consultation ${i + 1}`}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {showConsultsError && (
            <span className="text-caption text-d-700 mt-2 flex items-center gap-1.5">
              <Icon name="triangle-alert" size={13} /> {showConsultsError}
            </span>
          )}
          {consults.length < MAX_CONSULTATIONS && (
            <Button variant="ghost" size="sm" icon="plus" className="mt-2.5" onClick={addConsult}>
              Add another consultation
            </Button>
          )}
        </div>
        <div className="mt-4.5">
          <Field label="Note (Optional)">
            {(field) => (
              <textarea
                id={field.id}
                value={form.values.remark}
                maxLength={REMARK_MAX}
                onChange={(e) => form.setField('remark', e.target.value)}
                placeholder="Add any relevant notes..."
                className="rounded-input border-border text-body-lg text-text-strong h-23 w-full resize-none border p-3.5"
              ></textarea>
            )}
          </Field>
        </div>
        {priced.length > 0 && (
          <div className="border-border-soft text-body mt-4 overflow-hidden rounded-md border">
            {quoted ? (
              <>
                <div className="bg-bg-tint text-text-navy flex items-center justify-between px-3.5 py-2.5 font-medium">
                  <span className="flex items-center gap-2">
                    <Icon name="indian-rupee" size={16} className="text-text-muted" />
                    {priced.length > 1 ? `${priced.length} consultations` : 'Fee'} (with tax)
                  </span>
                  <span className="tabular-nums">{money(quoted.totalRupees)}</span>
                </div>
                <ul className="text-caption text-text-muted px-3.5 py-2">
                  {quoted.consultations.map((line) => {
                    const doctor = pricedDoctors[line.index];
                    return (
                      <li key={line.index} className="flex justify-between gap-3 py-0.5">
                        <span>
                          {doctor?.name ?? `Consultation ${line.index + 1}`}
                          {line.isFollowUp ? ' · follow-up' : ''}
                          {line.serviceRupees > 0 ? ` · service ${money(line.serviceRupees)}` : ''}
                          {line.taxRupees > 0 ? ` · tax ${money(line.taxRupees)}` : ''}
                        </span>
                        <span className="tabular-nums">
                          {line.totalRupees === 0 ? 'Free' : money(line.totalRupees)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <>
                <div className="bg-bg-tint text-text-navy flex items-center justify-between px-3.5 py-2.5 font-medium">
                  <span className="flex items-center gap-2">
                    <Icon name="indian-rupee" size={16} className="text-text-muted" />
                    {priced.length > 1 ? `${priced.length} consultations` : 'Consultation fee'}{' '}
                    (before tax)
                  </span>
                  <span className="tabular-nums">{quote.isFetching ? '…' : money(feeTotal)}</span>
                </div>
                <div className="text-caption text-text-muted px-3.5 py-2">
                  {followUpTotal < feeTotal
                    ? `Standard fee. If this counts as a follow-up with the same doctor, it is ${money(followUpTotal)}. `
                    : ''}
                  Tax and the final total are worked out by the booking and shown before you
                  collect.
                </div>
              </>
            )}
          </div>
        )}
        {!canCollect && (
          <div className="text-caption text-text-muted mt-3 flex items-center gap-1.5">
            <Icon name="info" size={13} />
            Your role does not take payments: book here, then send the patient to reception to pay.
          </div>
        )}
      </Card>
      <div className="flex justify-end gap-3.5">
        <Button variant="secondary" onClick={onDone} disabled={form.submitting}>
          Cancel
        </Button>
        <Button
          type="submit"
          icon={canCollect ? 'indian-rupee' : 'calendar-check'}
          busy={form.submitting}
        >
          {canCollect ? 'Book & Collect Payment' : 'Book'}
        </Button>
      </div>
      <AppointmentBookedModal
        appointments={booked?.appointments ?? null}
        patientName={patientName}
        onDone={onDone}
      />
    </Form>
  );
}
