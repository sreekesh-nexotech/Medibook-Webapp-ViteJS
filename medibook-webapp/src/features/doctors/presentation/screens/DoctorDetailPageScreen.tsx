import { useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { hospitalPath, isHospitalRole, type HospitalRole } from '@/app/router/paths';
import { isFailure } from '@/core/error/failure';
import { useSessionQuery } from '@/features/auth/application/queries/useSessionQuery';
import type { ShiftPattern, WeekDay } from '@/features/doctors/application/store/catalog.types';
import { summariseWeekHours } from '@/features/doctors/domain/schedule';
import type {
  Department,
  DoctorInput,
  DoctorProfile,
  DoctorScheduleData,
} from '@/features/doctors/domain/entities/doctors.types';
import { useDepartmentsQuery } from '@/features/doctors/application/queries/useDepartmentsQuery';
import {
  useCreateDoctorMutation,
  useDeleteDoctorMutation,
  useUpdateDoctorMutation,
} from '@/features/doctors/application/queries/useDoctorMutations';
import { useDoctorPhotoQuery } from '@/features/doctors/application/queries/useDoctorPhotoQuery';
import { useDoctorQuery } from '@/features/doctors/application/queries/useDoctorQuery';
import { useDoctorScheduleQuery } from '@/features/doctors/application/queries/useDoctorScheduleQuery';
import { useReplaceWeeklySessionsMutation } from '@/features/doctors/application/queries/useScheduleMutations';
import { useHospitalProfileQuery } from '@/features/settings/application/queries/useHospitalProfileQuery';
import { useHospitalRuleSettingsQuery } from '@/features/settings/application/queries/useHospitalRuleSettingsQuery';
import {
  useDoctorServicesQuery,
  useServicesQuery,
} from '@/features/settings/application/queries/services.queries';
import { money } from '@/shared/lib/format';
import { useFileUploadMutation } from '@/shared/hooks/useFileUploadMutation';
import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { describeFailure } from '@/shared/lib/serverErrors';
import { required } from '@/shared/lib/validate';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Can } from '@/shared/ui/Can';
import { Card } from '@/shared/ui/Card';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Field } from '@/shared/ui/Field';
import { Form } from '@/shared/ui/Form';
import { FormErrorSummary } from '@/shared/ui/FormErrorSummary';
import { Icon } from '@/shared/ui/Icon';
import { InfoDot } from '@/shared/ui/InfoDot';
import { SegTabs } from '@/shared/ui/SegTabs';
import { Select } from '@/shared/ui/Select';
import { SkeletonCards } from '@/shared/ui/Skeleton';
import { Tabs } from '@/shared/ui/Tabs';
import { TextInput } from '@/shared/ui/TextInput';
import { Toggle } from '@/shared/ui/Toggle';
import { toast } from '@/shared/ui/toast/toast.store';

import { DateExceptionsPanel } from '../components/DateExceptionsPanel';
import { DoctorReviews } from '../components/DoctorReviews';
import {
  DOCTOR_STATUS_LABEL,
  DOCTOR_STATUS_OPTIONS,
  doctorStatusFromLabel,
  feeError,
  gridToSessions,
  paiseToRupeeInput,
  ratingView,
  rupeeInputToPaise,
  sameSessions,
  sanitizeRupeeInput,
  sessionsToGrid,
  weekErrors,
  type DoctorStatusLabel,
  type WeekGrid,
} from '../components/doctors.view';
import { LeavePanel } from '../components/LeavePanel';
import { PhotoButton } from '../components/PhotoButton';
import { ScheduleChangeModal } from '../components/ScheduleChangeModal';
import { ScheduleHistory } from '../components/ScheduleHistory';
import { ShiftPatternsPanel } from '../components/ShiftPatternsPanel';
import { Stars } from '../components/Stars';
import { UpcomingDays } from '../components/UpcomingDays';
import { useScheduleConfirm } from '../components/useScheduleConfirm';
import { WeeklyHours } from '../components/WeeklyHours';

/** Backend bound on `experience_years`. */
const MAX_EXPERIENCE_YEARS = 80;

/** Backend bounds on `expected_consult_minutes`. */
const MIN_CONSULT_MINUTES = 1;
const MAX_CONSULT_MINUTES = 240;

/** Slot lengths offered (backend accepts 5–60 minutes, Q70). */
const SLOT_LENGTHS: readonly string[] = ['5', '10', '15', '20', '25', '30', '40', '45', '60'];

/** The backend's default slot length for a new doctor. */
const DEFAULT_SLOT_LENGTH = '15';

/** `SLOT_LENGTHS` plus the stored value when it is outside the list. */
function slotLengthOptions(current: string): readonly string[] {
  return SLOT_LENGTHS.includes(current)
    ? SLOT_LENGTHS
    : [...SLOT_LENGTHS, current].sort((a, b) => Number(a) - Number(b));
}

/** The backend's answer for an unknown doctor id. */
const NOT_FOUND_KIND = 'notFound';

/** Editor tabs; `?tab=availability` opens the second one (UAT-73). */
const TAB_PROFILE = 'Profile';
const TAB_AVAILABILITY = 'Availability';
const TAB_REVIEWS = 'Reviews';
const TAB_PARAM = 'tab';
const TAB_FROM_PARAM: Readonly<Record<string, string>> = {
  profile: TAB_PROFILE,
  availability: TAB_AVAILABILITY,
  reviews: TAB_REVIEWS,
};

/**
 * Router state that keeps the editor mounted when Add Doctor moves from
 * `/doctors/new` to the created doctor's own address (UAT-20): the editor is
 * keyed by this instead of the id, so the unsaved weekly hours survive.
 */
interface EditorRouteState {
  readonly editorKey?: string;
}
const NEW_EDITOR_KEY = 'new';

function editorKeyOf(state: unknown): string | null {
  if (typeof state !== 'object' || state === null || !('editorKey' in state)) return null;
  const key = (state as EditorRouteState).editorKey;
  return typeof key === 'string' ? key : null;
}

/** Same rule as department codes: a slug-like key (`{DOC}` in token labels). */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const SLUG_MAX_LENGTH = 60;

/** A new doctor starts consulting Mon–Fri 9–5 (design default). */
const NEW_DOCTOR_WEEK: WeekGrid = sessionsToGrid(
  [0, 1, 2, 3, 4].map((weekday) => ({
    weekday,
    sessionCode: 'morning',
    label: 'Morning',
    startsAt: '09:00',
    endsAt: '17:00',
  })),
);

/** Editable draft — fees are rupee text ("499.50") and numbers are digits until parsed on save. */
interface DoctorForm {
  name: string;
  /** Empty on a new doctor = let the server make the slug (UAT-49). */
  slug: string;
  title: string;
  departmentId: string;
  spec: string;
  room: string;
  qual: string;
  exp: string;
  reg: string;
  fee: string;
  /** Empty = a follow-up costs the consultation fee. */
  followUpFee: string;
  /** Empty = the hospital's default consultation time. */
  consultMinutes: string;
  slotLength: string;
  bookableOnline: boolean;
  status: DoctorStatusLabel;
  photoFileId: string | null;
  about: string;
}

/** Declared at module level so `useForm`'s error memo stays stable. */
const DOCTOR_VALIDATORS: FormValidators<DoctorForm> = {
  name: (v) => required(v, 'Doctor name'),
  slug: (v) => {
    const slug = v.trim();
    if (slug === '') return undefined;
    if (slug.length > SLUG_MAX_LENGTH) return `Use at most ${SLUG_MAX_LENGTH} characters.`;
    return SLUG_PATTERN.test(slug)
      ? undefined
      : 'Use lowercase letters, digits and dashes (e.g. dr-asha-verma).';
  },
  spec: (v) => required(v, 'Specialization'),
  fee: (v) => feeError(v, 'Consultation fee'),
  followUpFee: (v) =>
    v.trim() === '' || rupeeInputToPaise(v) !== null
      ? undefined
      : 'Follow-up fee must be an amount in rupees, or empty.',
  departmentId: (v) => (v ? undefined : 'Assign a department.'),
  exp: (v) =>
    v === '' || Number(v) <= MAX_EXPERIENCE_YEARS
      ? undefined
      : `Experience can be at most ${MAX_EXPERIENCE_YEARS} years.`,
  consultMinutes: (v) =>
    v === '' || (Number(v) >= MIN_CONSULT_MINUTES && Number(v) <= MAX_CONSULT_MINUTES)
      ? undefined
      : `Consultation time must be ${MIN_CONSULT_MINUTES}–${MAX_CONSULT_MINUTES} minutes.`,
};

/** Keep only digits, so the ₹ prefix the input shows never reaches the value. */
function digits(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

function failureText(error: unknown, fallback: string): string {
  return describeFailure(error, fallback);
}

/** Server field → profile form field (UAT-48). */
const DOCTOR_SERVER_FIELDS = {
  name: 'name',
  slug: 'slug',
  title: 'title',
  department_id: 'departmentId',
  specialisation: 'spec',
  qualification: 'qual',
  registration_no: 'reg',
  experience_years: 'exp',
  bio: 'about',
  room: 'room',
  consultation_fee_paise: 'fee',
  follow_up_fee_paise: 'followUpFee',
  expected_consult_minutes: 'consultMinutes',
  slot_length_min: 'slotLength',
  is_bookable_online: 'bookableOnline',
  status: 'status',
  photo_file_id: 'photoFileId',
} as const;

/** Server keys that belong to the weekly-hours editor, for the summary. */
const SESSION_LABELS: Readonly<Record<string, string>> = {
  sessions: 'Working hours',
  slug: 'Short code',
};

function blankDoctorForm(): DoctorForm {
  return {
    name: '',
    slug: '',
    title: '',
    departmentId: '',
    spec: '',
    room: '',
    qual: '',
    exp: '',
    reg: '',
    fee: '',
    followUpFee: '',
    consultMinutes: '',
    slotLength: DEFAULT_SLOT_LENGTH,
    bookableOnline: true,
    status: 'Active',
    photoFileId: null,
    about: '',
  };
}

function toForm(d: DoctorProfile): DoctorForm {
  return {
    name: d.name,
    slug: d.slug,
    title: d.title,
    departmentId: d.departmentId,
    spec: d.specialisation,
    room: d.room,
    qual: d.qualification,
    exp: d.experienceYears === null ? '' : String(d.experienceYears),
    reg: d.registrationNo,
    fee: paiseToRupeeInput(d.feePaise),
    followUpFee: d.followUpFeePaise === null ? '' : paiseToRupeeInput(d.followUpFeePaise),
    consultMinutes: d.expectedConsultMinutes === null ? '' : String(d.expectedConsultMinutes),
    slotLength: String(d.slotLengthMin),
    bookableOnline: d.isBookableOnline,
    status: DOCTOR_STATUS_LABEL[d.status],
    photoFileId: d.photoFileId,
    about: d.bio,
  };
}

/** The draft in API units. `stored` = the saved doctor, to send only a slug the user changed. */
function toInput(values: DoctorForm, stored: DoctorProfile | null): DoctorInput {
  const slug = values.slug.trim();
  const typedSlug = slug !== '' && slug !== stored?.slug;
  const followUp = values.followUpFee.trim();
  return {
    name: values.name.trim(),
    title: values.title.trim(),
    departmentId: values.departmentId,
    specialisation: values.spec.trim(),
    qualification: values.qual.trim(),
    registrationNo: values.reg.trim(),
    experienceYears: values.exp === '' ? null : Number(values.exp),
    bio: values.about.trim(),
    room: values.room.trim(),
    feePaise: rupeeInputToPaise(values.fee) ?? 0,
    followUpFeePaise: followUp === '' ? null : rupeeInputToPaise(followUp),
    expectedConsultMinutes: values.consultMinutes === '' ? null : Number(values.consultMinutes),
    slotLengthMin: Number(values.slotLength),
    isBookableOnline: values.bookableOnline,
    status: doctorStatusFromLabel(values.status),
    photoFileId: values.photoFileId,
    ...(typedSlug && { slug }),
  };
}

interface DoctorEditorProps {
  role: HospitalRole;
  /** The stored record, or `null` for `/doctors/new`. */
  doctor: DoctorProfile | null;
  /** The doctor's schedule (`null` for a new doctor, or while it loads after Add Doctor). */
  schedule: DoctorScheduleData | null;
  departments: readonly Department[];
  /** The tab to open on (`?tab=availability`). */
  initialTab: string;
}

/**
 * The doctor profile editor, saving to the hospital API. Mounted with a `key`
 * per doctor id, so the draft is initialised once per doctor.
 *
 * Save Changes writes the profile (`PATCH`, or `POST` for a new doctor) and,
 * when the working hours changed, replaces the weekly sessions. Both are dry
 * runs first: if the change would cancel bookings, the user is shown them and
 * asked before anything is applied. Leave and date exceptions are saved by
 * their own panels the moment they are edited.
 */
function DoctorEditor({ role, doctor, schedule, departments, initialTab }: DoctorEditorProps) {
  const navigate = useNavigate();
  const isNew = doctor === null;
  const createDoctor = useCreateDoctorMutation();
  const updateDoctor = useUpdateDoctorMutation();
  const deleteDoctor = useDeleteDoctorMutation();
  const replaceSessions = useReplaceWeeklySessionsMutation();
  const upload = useFileUploadMutation();
  const scheduleConfirm = useScheduleConfirm();
  const { data: session } = useSessionQuery('hospital');
  const profileQuery = useHospitalProfileQuery();
  const onlineBooking = profileQuery.data?.onlineBookingEnabled;
  const rulesQuery = useHospitalRuleSettingsQuery();
  const hospitalConsultMinutes = rulesQuery.data?.expectedConsultMinutes ?? null;
  const followUpWindowDays = rulesQuery.data?.followUpWindowDays ?? null;
  const doctorServicesQuery = useDoctorServicesQuery();
  const servicesQuery = useServicesQuery();
  const [tab, setTab] = useState(initialTab);
  // Set once Add Doctor has created the record: retries edit it (UAT-20).
  const [created, setCreated] = useState<DoctorProfile | null>(null);
  const [showWeekErrors, setShowWeekErrors] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  /** The weekly grid + this doctor's named sessions — the Availability draft. */
  const initialGrid = schedule ? sessionsToGrid(schedule.weeklySessions) : NEW_DOCTOR_WEEK;
  const [grid, setGrid] = useState<WeekGrid>(initialGrid);
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);

  const back = (): void => {
    void navigate(hospitalPath(role, 'doctors'));
  };

  const finish = (): void => {
    toast(isNew ? 'Doctor added' : 'Doctor profile saved', 'success');
    back();
  };

  const week = weekErrors(grid.week);
  const hasWeekErrors = Object.keys(week).length > 0;

  /** Replace the weekly sessions when they changed, then finish. */
  const saveWeek = async (doctorId: string, version: number, isFresh: boolean): Promise<void> => {
    const sessions = gridToSessions(grid);
    if (schedule && sameSessions(sessions, schedule.weeklySessions)) {
      finish();
      return;
    }
    await scheduleConfirm.run({
      attempt: (mode) => replaceSessions.mutateAsync({ doctorId, sessions, version, mode }),
      onApplied: finish,
      onError: (error) => {
        setTab(TAB_AVAILABILITY);
        const reason = form.applyServerErrors(
          error,
          { fields: DOCTOR_SERVER_FIELDS, labels: SESSION_LABELS },
          'Could not save the working hours.',
        );
        toast(
          isFresh
            ? `Doctor added, but the working hours were not saved — ${reason} Fix them and press Save Changes.`
            : reason,
          'error',
        );
      },
    });
  };

  const form = useForm<DoctorForm>({
    initial: doctor ? toForm(doctor) : blankDoctorForm(),
    validate: DOCTOR_VALIDATORS,
    onSubmit: async (values) => {
      // Hours are checked before anything is written, so an invalid day can
      // never leave a half-created doctor behind (06·Profile F2, F6).
      if (hasWeekErrors) {
        setShowWeekErrors(true);
        setTab(TAB_AVAILABILITY);
        toast('Fix the working hours before saving.', 'error');
        return;
      }
      const target = doctor ?? created;
      const input = toInput(values, target);
      const onError = (error: unknown): void => {
        toast(
          form.applyServerErrors(
            error,
            { fields: DOCTOR_SERVER_FIELDS, labels: SESSION_LABELS },
            'Could not save the doctor.',
          ),
          'error',
        );
      };
      if (!target) {
        let fresh: DoctorProfile;
        try {
          fresh = await createDoctor.mutateAsync(input);
        } catch (error) {
          onError(error);
          return;
        }
        // UAT-20: the doctor exists now. Move to its own address first — the
        // editor stays mounted (same key), so a failed hours save is retried
        // as an edit of this doctor, never a second Add.
        setCreated(fresh);
        navigate(`${hospitalPath(role, 'doctors')}/${fresh.id}`, {
          replace: true,
          state: { editorKey: NEW_EDITOR_KEY } satisfies EditorRouteState,
        });
        await saveWeek(fresh.id, fresh.version, true);
        return;
      }
      await scheduleConfirm.run({
        attempt: (mode) =>
          updateDoctor.mutateAsync({ id: target.id, input, version: target.version, mode }),
        // Awaited, so Save stays busy until the hours are saved too (06·Profile F10).
        onApplied: (change) => saveWeek(target.id, change.result?.version ?? target.version, false),
        onError,
      });
    },
  });

  const values = form.values;
  const photo = useDoctorPhotoQuery(localPhoto ? null : values.photoFileId);
  const photoSrc = localPhoto ?? photo.data ?? undefined;

  const pickPhoto = (file: File): void => {
    upload.mutate(
      { file, purpose: 'doctor_photo' },
      {
        onSuccess: (stored) => {
          form.setField('photoFileId', stored.id);
          if (localPhoto) URL.revokeObjectURL(localPhoto);
          setLocalPhoto(URL.createObjectURL(file));
        },
        onError: (error) => toast(failureText(error, 'Could not upload the photo.'), 'error'),
      },
    );
  };

  const del = (): void => {
    setConfirmDelete(false);
    if (!doctor) return;
    void scheduleConfirm.run({
      attempt: (mode) => deleteDoctor.mutateAsync({ id: doctor.id, mode }),
      onApplied: () => {
        toast('Doctor profile deleted', 'info');
        back();
      },
      onError: (error) => toast(failureText(error, 'Could not delete the doctor.'), 'error'),
    });
  };

  const setWeek = (week: readonly WeekDay[]): void => setGrid((g) => ({ ...g, week }));
  // Keeps `codes`, so saved sessions keep their backend codes.
  const setPatterns = (patterns: readonly ShiftPattern[], week: readonly WeekDay[]): void =>
    setGrid((g) => ({ ...g, patterns, week }));

  const deptName = departments.find((d) => d.id === values.departmentId)?.name ?? '';
  const statusCaption =
    values.status === 'Inactive'
      ? 'Disabled — hidden from the patient app'
      : values.status === 'On Leave'
        ? 'Visible, booking paused'
        : !values.bookableOnline
          ? 'Visible, online booking off for this doctor'
          : onlineBooking === false
            ? 'Visible, online booking off for the hospital'
            : 'Live & bookable in the app';
  // Services this doctor offers (doctor-service links), with any price of their own.
  const offered =
    doctor && doctorServicesQuery.data && servicesQuery.data
      ? doctorServicesQuery.data
          .filter((l) => l.doctorId === doctor.id)
          .map((l) => {
            const service = servicesQuery.data.find((x) => x.id === l.serviceId);
            return {
              id: l.id,
              name: service?.name ?? 'A service',
              price: l.priceOverrideRupees ?? service?.priceRupees ?? null,
              ownPrice: l.priceOverrideRupees !== null,
            };
          })
      : null;
  const deptError = form.errorFor('departmentId');
  const weekSummary = summariseWeekHours(grid.week);
  const hospitalName = session?.surface === 'hospital' ? session.hospital.name : '';
  const isSaving = form.submitting || scheduleConfirm.modal.isApplying;
  const rating = doctor ? ratingView(doctor) : null;
  const bookable = values.status === 'Active' && values.bookableOnline && onlineBooking !== false;

  return (
    <div className="flex max-w-260 flex-col gap-5">
      <Card pad={22} className="flex flex-wrap items-center gap-4.5">
        <Avatar name={values.name || '?'} src={photoSrc} size={64} />
        <div className="min-w-55 flex-1">
          <div className="flex items-center gap-2.5">
            <span className="text-h1 text-text-strong">
              {values.name || (isNew ? 'New Doctor Profile' : 'Doctor')}
            </span>
            <Badge status={values.status} />
          </div>
          <div className="text-body text-text-muted mt-1.25 flex flex-wrap items-center gap-3">
            {values.title && <span>{values.title} ·</span>}
            {values.spec && <span>{values.spec}</span>}
            {deptName && (
              <span>
                {values.spec ? '· ' : ''}
                {deptName}
              </span>
            )}
            {rating && (
              <span>
                ·{' '}
                <span className="inline-flex items-center gap-1">
                  <Icon
                    name="star"
                    size={14}
                    className="text-y-500"
                    style={{ fill: 'var(--color-y-500)' }}
                  />{' '}
                  {rating.value} {rating.note}
                </span>
              </span>
            )}
            {hospitalName && <span>· {hospitalName}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="text-caption text-text-muted">Profile status</span>
          <SegTabs
            tabs={DOCTOR_STATUS_OPTIONS}
            value={values.status}
            onChange={(v) => form.setField('status', DOCTOR_STATUS_LABEL[doctorStatusFromLabel(v)])}
          />
          <span className="text-caption text-text-muted">{statusCaption}</span>
        </div>
      </Card>

      <Card pad={0} className="overflow-hidden">
        <div className="px-5.5 pt-4">
          <Tabs
            tabs={
              isNew ? [TAB_PROFILE, TAB_AVAILABILITY] : [TAB_PROFILE, TAB_AVAILABILITY, TAB_REVIEWS]
            }
            value={tab}
            onChange={setTab}
          />
        </div>
        <div className="p-5.5">
          <FormErrorSummary messages={form.serverSummary} className="mb-4" />
          {tab === TAB_PROFILE && (
            <Form onSubmit={form.handleSubmit} className="flex flex-col gap-4">
              <div className="flex items-center gap-3.5">
                <Avatar name={values.name || '?'} src={photoSrc} size={56} />
                <PhotoButton
                  onPick={pickPhoto}
                  disabled={upload.isPending}
                  label={
                    upload.isPending
                      ? 'Uploading…'
                      : values.photoFileId
                        ? 'Change Photo'
                        : 'Upload Photo'
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-x-4.5 gap-y-4">
                <Field label="Full Name" required error={form.errorFor('name')}>
                  <TextInput
                    value={values.name}
                    placeholder="e.g. Dr. Asha Verma"
                    autoComplete="name"
                    onChange={(v) => form.setField('name', v)}
                    onBlur={() => form.blurField('name')}
                  />
                </Field>
                <Field
                  label="Title"
                  hint="Shown under the name in the patient app."
                  error={form.errorFor('title')}
                >
                  <TextInput
                    value={values.title}
                    placeholder="e.g. Senior Consultant"
                    onChange={(v) => form.setField('title', v)}
                  />
                </Field>
                <Field
                  label="Short code"
                  error={form.errorFor('slug')}
                  hint={
                    isNew
                      ? 'Optional. Leave empty and Medibook makes one from the name.'
                      : 'Used in token labels that use {DOC}. Changing it does not relabel issued tokens.'
                  }
                >
                  <TextInput
                    value={values.slug}
                    placeholder="e.g. dr-asha-verma"
                    maxLength={SLUG_MAX_LENGTH}
                    onChange={(v) => form.setField('slug', v.toLowerCase())}
                    onBlur={() => form.blurField('slug')}
                  />
                </Field>
                <Field label="Specialization" required error={form.errorFor('spec')}>
                  <TextInput
                    value={values.spec}
                    placeholder="e.g. Cardiologist"
                    onChange={(v) => form.setField('spec', v)}
                    onBlur={() => form.blurField('spec')}
                  />
                </Field>
                <Field label="Room Number" error={form.errorFor('room')}>
                  <TextInput
                    value={values.room}
                    placeholder="e.g. 101"
                    onChange={(v) => form.setField('room', v)}
                  />
                </Field>
                <Field label="Qualification" error={form.errorFor('qual')}>
                  <TextInput
                    value={values.qual}
                    placeholder="MBBS, MD"
                    onChange={(v) => form.setField('qual', v)}
                  />
                </Field>
                <Field label="Experience (years)" error={form.errorFor('exp')}>
                  <TextInput
                    value={values.exp}
                    placeholder="e.g. 12"
                    inputMode="numeric"
                    onChange={(v) => form.setField('exp', digits(v))}
                    onBlur={() => form.blurField('exp')}
                  />
                </Field>
                <Field label="Registration No." error={form.errorFor('reg')}>
                  <TextInput
                    value={values.reg}
                    placeholder="KMC/…"
                    onChange={(v) => form.setField('reg', v)}
                  />
                </Field>
                <Field label="Status">
                  <Select
                    value={values.status}
                    options={DOCTOR_STATUS_OPTIONS}
                    onChange={(v) =>
                      form.setField('status', DOCTOR_STATUS_LABEL[doctorStatusFromLabel(v)])
                    }
                  />
                </Field>
                <Field label="Hospital">
                  <TextInput value={hospitalName} readOnly />
                </Field>
                <Field
                  label="Consultation Fee"
                  required
                  error={form.errorFor('fee')}
                  hint="In rupees; paise allowed (e.g. 499.50). Enter 0 for a free consultation."
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <TextInput
                        value={values.fee}
                        icon="indian-rupee"
                        placeholder="0"
                        inputMode="decimal"
                        onChange={(v) => form.setField('fee', sanitizeRupeeInput(v))}
                        onBlur={() => form.blurField('fee')}
                      />
                    </div>
                    <InfoDot text="What patients pay & see in the app for a consultation with this doctor." />
                  </div>
                </Field>
                <Field
                  label="Follow-up Fee"
                  error={form.errorFor('followUpFee')}
                  hint={`Charged for a follow-up within ${
                    followUpWindowDays === null
                      ? "the hospital's follow-up window"
                      : `${followUpWindowDays} days of the last visit (Hospital Settings)`
                  }. Leave empty to charge the consultation fee; 0 makes follow-ups free.`}
                >
                  <TextInput
                    value={values.followUpFee}
                    icon="indian-rupee"
                    placeholder="Same as consultation"
                    inputMode="decimal"
                    onChange={(v) => form.setField('followUpFee', sanitizeRupeeInput(v))}
                    onBlur={() => form.blurField('followUpFee')}
                  />
                </Field>
              </div>
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-label font-ui text-text-strong">Department</span>
                  <span className="text-d-500">*</span>
                  <InfoDot text="A doctor belongs to one department." />
                </div>
                {departments.length === 0 && (
                  <span className="text-caption text-text-muted">
                    Add a department first (Doctors & Departments → Departments).
                  </span>
                )}
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Department">
                  {departments.map(({ id, name, isActive }) => {
                    const on = values.departmentId === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => form.setField('departmentId', id)}
                        className={
                          on
                            ? 'text-body border-blue bg-blue-soft-bg text-blue inline-flex cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-3.5 py-1.75'
                            : 'text-body border-border text-text-body inline-flex cursor-pointer items-center gap-1.5 rounded-full border bg-white px-3.5 py-1.75'
                        }
                      >
                        {on && <Icon name="check" size={14} />}
                        {name}
                        {!isActive && (
                          <span className="text-caption text-text-muted">(inactive)</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {deptError && (
                  <span className="text-caption text-d-700 mt-2 flex items-center gap-1.5">
                    <Icon name="triangle-alert" size={13} /> {deptError}
                  </span>
                )}
              </div>
              {doctor && (
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-label font-ui text-text-strong">Services offered</span>
                    <InfoDot text="Procedures and tests booked with this doctor. Managed in Services & Pricing." />
                  </div>
                  {doctorServicesQuery.isError || servicesQuery.isError ? (
                    <span className="text-caption text-text-muted">
                      Services could not be loaded.
                    </span>
                  ) : offered === null ? (
                    <span className="text-caption text-text-muted">Loading…</span>
                  ) : offered.length === 0 ? (
                    <span className="text-caption text-text-muted">
                      None — this doctor takes consultations only.
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {offered.map((o) => (
                        <span
                          key={o.id}
                          className="text-body border-border text-text-body rounded-full border bg-white px-3.5 py-1.75"
                        >
                          {o.name}
                          {o.price !== null && (
                            <span className="text-caption text-text-muted">
                              {' '}
                              · {money(o.price)}
                              {o.ownPrice ? ' (this doctor)' : ''}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <Field label="About" error={form.errorFor('about')}>
                {(field) => (
                  <textarea
                    id={field.id}
                    value={values.about}
                    placeholder="Short bio shown in the patient app"
                    onChange={(e) => form.setField('about', e.target.value)}
                    className="border-border text-body-lg text-text-strong rounded-input box-border h-18 w-full resize-none border p-3"
                  />
                )}
              </Field>
            </Form>
          )}

          {tab === TAB_AVAILABILITY && (
            <div className="flex flex-col gap-5">
              <div>
                <div className="text-body text-text-strong mb-2.5 flex flex-wrap items-center gap-2 font-medium">
                  Consultation Settings
                  <InfoDot text="This doctor's own settings, saved with Save Changes. Changing the slot length regenerates future slots; you are shown any bookings it affects before it applies." />
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="border-border-soft flex flex-wrap items-center justify-between gap-3 border-b py-2.5">
                    <span className="text-body text-text-body">Slot length</span>
                    <div className="w-32">
                      <Select
                        value={values.slotLength}
                        options={slotLengthOptions(values.slotLength)}
                        onChange={(v) => form.setField('slotLength', v)}
                        height={40}
                        aria-label="Slot length in minutes"
                      />
                    </div>
                  </div>
                  <div className="border-border-soft flex flex-wrap items-center justify-between gap-3 border-b py-2.5">
                    <span className="text-body text-text-body">
                      Expected consultation time
                      <span className="text-caption text-text-muted block">
                        Used for patients' wait estimates. Empty ={' '}
                        {hospitalConsultMinutes === null
                          ? 'the hospital default'
                          : `the hospital default, ${hospitalConsultMinutes} min`}
                        .
                      </span>
                    </span>
                    <div className="w-32">
                      <TextInput
                        value={values.consultMinutes}
                        placeholder={
                          hospitalConsultMinutes === null
                            ? 'Default'
                            : `${hospitalConsultMinutes} min`
                        }
                        inputMode="numeric"
                        aria-label="Expected consultation time in minutes"
                        onChange={(v) => form.setField('consultMinutes', digits(v))}
                        onBlur={() => form.blurField('consultMinutes')}
                      />
                    </div>
                  </div>
                  {form.errorFor('consultMinutes') && (
                    <span className="text-caption text-d-700">
                      {form.errorFor('consultMinutes')}
                    </span>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                    <span className="text-body text-text-body">
                      Online booking for this doctor
                      <span className="text-caption text-text-muted block">
                        {onlineBooking === undefined
                          ? profileQuery.isError
                            ? 'Hospital-wide setting unavailable.'
                            : 'Checking the hospital-wide setting…'
                          : onlineBooking
                            ? bookable
                              ? 'Patients can book this doctor in the Medibook app.'
                              : 'Patients cannot book this doctor in the app.'
                            : 'Online booking is off for the whole hospital, so patients cannot book this doctor in the app.'}
                      </span>
                    </span>
                    <div className="flex items-center gap-2">
                      {onlineBooking === false && (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon="settings"
                          onClick={() => navigate(hospitalPath(role, 'settings'))}
                        >
                          Hospital Settings
                        </Button>
                      )}
                      <Toggle
                        value={values.bookableOnline}
                        onChange={(v) => form.setField('bookableOnline', v)}
                        label="Online booking for this doctor"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <WeeklyHours
                value={grid.week}
                onChange={setWeek}
                patterns={grid.patterns}
                errors={showWeekErrors ? week : undefined}
                info="The Medibook app only offers booking slots during these hours. Outside them, patients can't book."
              />
              <div className="text-caption text-text-muted flex items-center gap-1.5">
                <Icon name="clock" size={13} /> {weekSummary} · unsaved changes apply when you press{' '}
                {isNew ? 'Add Doctor' : 'Save Changes'}
              </div>
              <ShiftPatternsPanel
                patterns={grid.patterns}
                week={grid.week}
                onChange={setPatterns}
              />
              {doctor && schedule ? (
                <>
                  <UpcomingDays days={schedule.upcoming} />
                  <LeavePanel doctorId={doctor.id} leave={schedule.leaves} />
                  <DateExceptionsPanel doctorId={doctor.id} exceptions={schedule.dateExceptions} />
                  <ScheduleHistory doctorId={doctor.id} />
                </>
              ) : (
                <EmptyState
                  compact
                  icon="calendar-plus"
                  title="Leave and date exceptions open once the profile exists"
                  message="Add the doctor first — leave and per-date exceptions are saved against their record, so they need an id to attach to."
                />
              )}
            </div>
          )}

          {tab === TAB_REVIEWS && doctor && (
            <div>
              <div className="mb-3.5 flex items-center gap-2">
                <span className="text-caption text-text-muted">
                  Ratings come from patients in the Medibook app and are read-only.
                </span>
                <InfoDot text="You can't edit or delete patient reviews. Report abuse to Medibook support." />
              </div>
              <Card pad={16} className="mb-3.5 flex items-center gap-4">
                <div className="text-center">
                  <div className="text-text-strong text-h1 font-bold">
                    {ratingView(doctor).value}
                  </div>
                  <Stars r={ratingView(doctor).sortValue} />
                </div>
                <div className="text-body text-text-muted">
                  {doctor.ratingCount > 0
                    ? `Based on ${doctor.ratingCount} approved patient review${doctor.ratingCount === 1 ? '' : 's'}`
                    : doctor.ratingBase !== null
                      ? 'No approved reviews yet — the app shows this starting rating until there are.'
                      : 'No patient ratings yet'}
                </div>
              </Card>
              <DoctorReviews doctorId={doctor.id} />
            </div>
          )}
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        {doctor && (
          <Can perm={'Doctors & Departments.del'}>
            <Button
              variant="ghost"
              icon="trash-2"
              style={{ color: 'var(--color-d-500)' }}
              onClick={() => setConfirmDelete(true)}
            >
              Delete Profile
            </Button>
          </Can>
        )}
        <span className="flex-1" />
        <Button variant="secondary" onClick={back}>
          Cancel
        </Button>
        <Can
          perm={isNew ? 'Doctors & Departments.add' : 'Doctors & Departments.edit'}
          disableInstead
        >
          <Button icon="check" busy={isSaving} onClick={form.handleSubmit}>
            {isNew ? 'Add Doctor' : 'Save Changes'}
          </Button>
        </Can>
      </div>

      <ConfirmModal
        open={confirmDelete}
        danger
        confirmLabel="Delete"
        title="Delete Doctor Profile"
        body={`Delete ${values.name || 'this doctor'}'s profile? This removes them from the patient app and can't be undone.`}
        onClose={() => setConfirmDelete(false)}
        onConfirm={del}
      />
      <ScheduleChangeModal {...scheduleConfirm.modal} />
    </div>
  );
}

/** Doctor profile detail / editor (design `DoctorDetailPage`; `:id === 'new'` is blank). */
export function DoctorDetailPageScreen() {
  const { id: selId, role: roleParam } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const initialTab = TAB_FROM_PARAM[searchParams.get(TAB_PARAM) ?? ''] ?? TAB_PROFILE;
  // After Add Doctor the editor keeps its key ('new') at the doctor's own
  // address, so it is not remounted and its unsaved hours survive (UAT-20).
  const keptKey = editorKeyOf(location.state);
  const role = isHospitalRole(roleParam) ? roleParam : 'admin';
  const isNew = !selId || selId === 'new';
  const doctorId = isNew ? null : selId;
  const doctorQuery = useDoctorQuery(doctorId);
  const scheduleQuery = useDoctorScheduleQuery(doctorId);
  const departmentsQuery = useDepartmentsQuery();
  const toList = () => navigate(hospitalPath(role, 'doctors'));

  const failed = [doctorQuery, scheduleQuery, departmentsQuery].find((q) => q.isError);
  if (failed) {
    if (
      isFailure(failed.error) &&
      failed.error.kind === NOT_FOUND_KIND &&
      failed !== departmentsQuery
    ) {
      return (
        <ErrorState
          icon="user-x"
          title="Doctor not found"
          message="This profile is no longer in the catalogue — it may have been deleted on another screen."
          onRetry={toList}
          retryLabel="Back to Doctors & Departments"
        />
      );
    }
    return (
      <ErrorState
        title="Could not load this doctor"
        message={failureText(failed.error, 'Please try again.')}
        onRetry={() => {
          void doctorQuery.refetch();
          void scheduleQuery.refetch();
          void departmentsQuery.refetch();
        }}
      />
    );
  }

  // A just-created doctor's schedule loads while its editor stays on screen.
  const waitForSchedule = keptKey === null && scheduleQuery.isPending;
  const isLoading =
    departmentsQuery.isPending || (!isNew && (doctorQuery.isPending || waitForSchedule));
  if (isLoading) return <SkeletonCards count={2} lines={6} />;

  // Keyed by id: a different doctor is a different editor, with its own draft.
  return (
    <DoctorEditor
      key={keptKey ?? selId ?? NEW_EDITOR_KEY}
      role={role}
      doctor={doctorQuery.data ?? null}
      schedule={scheduleQuery.data ?? null}
      departments={departmentsQuery.data ?? []}
      initialTab={initialTab}
    />
  );
}
