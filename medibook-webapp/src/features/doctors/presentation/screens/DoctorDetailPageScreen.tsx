import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

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
import { useSettingsStore } from '@/features/settings/application/store/settings.store';
import { useFileUploadMutation } from '@/shared/hooks/useFileUploadMutation';
import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { positiveAmount, required } from '@/shared/lib/validate';
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
import { Icon } from '@/shared/ui/Icon';
import { InfoDot } from '@/shared/ui/InfoDot';
import { SegTabs } from '@/shared/ui/SegTabs';
import { Select } from '@/shared/ui/Select';
import { SkeletonCards } from '@/shared/ui/Skeleton';
import { Tabs } from '@/shared/ui/Tabs';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import { DateExceptionsPanel } from '../components/DateExceptionsPanel';
import {
  DOCTOR_STATUS_LABEL,
  DOCTOR_STATUS_OPTIONS,
  doctorStatusFromLabel,
  gridToSessions,
  sameSessions,
  sessionsToGrid,
  type DoctorStatusLabel,
  type WeekGrid,
} from '../components/doctors.view';
import { LeavePanel } from '../components/LeavePanel';
import { PhotoButton } from '../components/PhotoButton';
import { ScheduleChangeModal } from '../components/ScheduleChangeModal';
import { ShiftPatternsPanel } from '../components/ShiftPatternsPanel';
import { Stars } from '../components/Stars';
import { useScheduleConfirm } from '../components/useScheduleConfirm';
import { WeeklyHours } from '../components/WeeklyHours';

/** Backend bound on `experience_years`. */
const MAX_EXPERIENCE_YEARS = 80;

/** The backend's answer for an unknown doctor id. */
const NOT_FOUND_KIND = 'notFound';

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

/** Editable draft — `fee` and `exp` are digits-only text until parsed on save. */
interface DoctorForm {
  name: string;
  departmentId: string;
  spec: string;
  room: string;
  qual: string;
  exp: string;
  reg: string;
  fee: string;
  status: DoctorStatusLabel;
  photoFileId: string | null;
  about: string;
}

/** Declared at module level so `useForm`'s error memo stays stable. */
const DOCTOR_VALIDATORS: FormValidators<DoctorForm> = {
  name: (v) => required(v, 'Doctor name'),
  spec: (v) => required(v, 'Specialization'),
  fee: (v) => positiveAmount(v, 'Consultation fee'),
  departmentId: (v) => (v ? undefined : 'Assign a department.'),
  exp: (v) =>
    v === '' || Number(v) <= MAX_EXPERIENCE_YEARS
      ? undefined
      : `Experience can be at most ${MAX_EXPERIENCE_YEARS} years.`,
};

/** Keep only digits, so the ₹ prefix the input shows never reaches the value. */
function digits(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

function failureText(error: unknown, fallback: string): string {
  return isFailure(error) ? error.message : fallback;
}

function blankDoctorForm(): DoctorForm {
  return {
    name: '',
    departmentId: '',
    spec: '',
    room: '',
    qual: '',
    exp: '',
    reg: '',
    fee: '',
    status: 'Active',
    photoFileId: null,
    about: '',
  };
}

function toForm(d: DoctorProfile): DoctorForm {
  return {
    name: d.name,
    departmentId: d.departmentId,
    spec: d.specialisation,
    room: d.room,
    qual: d.qualification,
    exp: d.experienceYears === null ? '' : String(d.experienceYears),
    reg: d.registrationNo,
    fee: d.feeRupees ? String(d.feeRupees) : '',
    status: DOCTOR_STATUS_LABEL[d.status],
    photoFileId: d.photoFileId,
    about: d.bio,
  };
}

function toInput(values: DoctorForm): DoctorInput {
  return {
    name: values.name.trim(),
    departmentId: values.departmentId,
    specialisation: values.spec.trim(),
    qualification: values.qual.trim(),
    registrationNo: values.reg.trim(),
    experienceYears: values.exp === '' ? null : Number(values.exp),
    bio: values.about.trim(),
    room: values.room.trim(),
    feeRupees: Number(digits(values.fee)) || 0,
    status: doctorStatusFromLabel(values.status),
    photoFileId: values.photoFileId,
  };
}

interface DoctorEditorProps {
  role: HospitalRole;
  /** The stored record, or `null` for `/doctors/new`. */
  doctor: DoctorProfile | null;
  /** The doctor's schedule (`null` for a new doctor). */
  schedule: DoctorScheduleData | null;
  departments: readonly Department[];
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
function DoctorEditor({ role, doctor, schedule, departments }: DoctorEditorProps) {
  const navigate = useNavigate();
  const isNew = doctor === null;
  const createDoctor = useCreateDoctorMutation();
  const updateDoctor = useUpdateDoctorMutation();
  const deleteDoctor = useDeleteDoctorMutation();
  const replaceSessions = useReplaceWeeklySessionsMutation();
  const upload = useFileUploadMutation();
  const scheduleConfirm = useScheduleConfirm();
  const { data: session } = useSessionQuery('hospital');
  const rules = useSettingsStore((s) => s.settings.rules);
  const [tab, setTab] = useState('Profile');
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

  const onError = (error: unknown): void => {
    toast(failureText(error, 'Could not save the doctor.'), 'error');
  };

  /** Replace the weekly sessions when they changed, then finish. */
  const saveWeek = async (doctorId: string, version: number): Promise<void> => {
    const sessions = gridToSessions(grid);
    if (schedule && sameSessions(sessions, schedule.weeklySessions)) {
      finish();
      return;
    }
    await scheduleConfirm.run({
      attempt: (confirm) => replaceSessions.mutateAsync({ doctorId, sessions, version, confirm }),
      onApplied: finish,
      onError,
    });
  };

  const form = useForm<DoctorForm>({
    initial: doctor ? toForm(doctor) : blankDoctorForm(),
    validate: DOCTOR_VALIDATORS,
    onSubmit: async (values) => {
      const input = toInput(values);
      if (!doctor) {
        try {
          const created = await createDoctor.mutateAsync(input);
          await saveWeek(created.id, created.version);
        } catch (error) {
          onError(error);
        }
        return;
      }
      await scheduleConfirm.run({
        attempt: (confirm) =>
          updateDoctor.mutateAsync({ id: doctor.id, input, version: doctor.version, confirm }),
        onApplied: (change) => {
          void saveWeek(doctor.id, change.result?.version ?? doctor.version);
        },
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
      attempt: (confirm) => deleteDoctor.mutateAsync({ id: doctor.id, confirm }),
      onApplied: () => {
        toast('Doctor profile deleted', 'info');
        back();
      },
      onError: (error) => toast(failureText(error, 'Could not delete the doctor.'), 'error'),
    });
  };

  const setWeek = (week: readonly WeekDay[]): void => setGrid((g) => ({ ...g, week }));
  const setPatterns = (patterns: readonly ShiftPattern[], week: readonly WeekDay[]): void =>
    setGrid({ patterns, week });

  const deptName = departments.find((d) => d.id === values.departmentId)?.name ?? '';
  const statusCaption =
    values.status === 'Inactive'
      ? 'Disabled — hidden from the patient app'
      : values.status === 'On Leave'
        ? 'Visible, booking paused'
        : 'Live & bookable in the app';
  const deptError = form.errorFor('departmentId');
  const weekSummary = summariseWeekHours(grid.week);
  const hospitalName = session?.surface === 'hospital' ? session.hospital.name : '';
  const isSaving = form.submitting || scheduleConfirm.modal.isApplying;

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
            {values.spec && <span>{values.spec}</span>}
            {deptName && (
              <span>
                {values.spec ? '· ' : ''}
                {deptName}
              </span>
            )}
            {!isNew && doctor && (
              <span>
                ·{' '}
                <span className="inline-flex items-center gap-1">
                  <Icon
                    name="star"
                    size={14}
                    className="text-y-500"
                    style={{ fill: 'var(--color-y-500)' }}
                  />{' '}
                  {doctor.ratingAvg === null ? '—' : doctor.ratingAvg.toFixed(1)} (
                  {doctor.ratingCount})
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
            tabs={isNew ? ['Profile', 'Availability'] : ['Profile', 'Availability', 'Reviews']}
            value={tab}
            onChange={setTab}
          />
        </div>
        <div className="p-5.5">
          {tab === 'Profile' && (
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
                <Field label="Specialization" required error={form.errorFor('spec')}>
                  <TextInput
                    value={values.spec}
                    placeholder="e.g. Cardiologist"
                    onChange={(v) => form.setField('spec', v)}
                    onBlur={() => form.blurField('spec')}
                  />
                </Field>
                <Field label="Room Number">
                  <TextInput
                    value={values.room}
                    placeholder="e.g. 101"
                    onChange={(v) => form.setField('room', v)}
                  />
                </Field>
                <Field label="Qualification">
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
                <Field label="Registration No.">
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
                  className="col-span-full"
                >
                  <div className="flex items-center gap-2">
                    <div className="max-w-90 flex-1">
                      <TextInput
                        value={values.fee ? `₹ ${values.fee}` : ''}
                        placeholder="₹ 0"
                        inputMode="numeric"
                        onChange={(v) => form.setField('fee', digits(v))}
                        onBlur={() => form.blurField('fee')}
                      />
                    </div>
                    <InfoDot text="What patients pay & see in the app for a consultation with this doctor." />
                  </div>
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
                  {departments.map(({ id, name }) => {
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
              <Field label="About">
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

          {tab === 'Availability' && (
            <div className="flex flex-col gap-5">
              <div>
                <div className="text-body text-text-strong mb-2.5 flex flex-wrap items-center gap-2 font-medium">
                  Consultation Settings
                  <InfoDot text="These are hospital-wide rules. They are set once in Hospital Settings and every doctor's slots are generated from them." />
                  <span className="flex-1" />
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="settings"
                    onClick={() => navigate(hospitalPath(role, 'settings'))}
                  >
                    Change in Hospital Settings
                  </Button>
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="border-border-soft flex items-center justify-between border-b py-2.5">
                    <span className="text-body text-text-body">Consultation duration</span>
                    <span className="text-body text-text-strong font-medium">
                      {schedule ? `${schedule.slotLengthMin} min` : rules.duration}
                    </span>
                  </div>
                  <div className="border-border-soft flex items-center justify-between border-b py-2.5">
                    <span className="text-body text-text-body">Max appointments per slot</span>
                    <span className="text-body text-text-strong font-medium">
                      {rules.maxPerSlot}
                    </span>
                  </div>
                  <div className="border-border-soft flex items-center justify-between border-b py-2.5">
                    <span className="text-body text-text-body">Buffer between appointments</span>
                    <span className="text-body text-text-strong font-medium">{rules.buffer}</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-body text-text-body">Online appointment booking</span>
                    <Badge status={rules.onlineBooking ? 'Enabled' : 'Blocked'}>
                      {rules.onlineBooking ? 'Enabled' : 'Off'}
                    </Badge>
                  </div>
                </div>
              </div>
              <WeeklyHours
                value={grid.week}
                onChange={setWeek}
                patterns={grid.patterns}
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
                  <LeavePanel doctorId={doctor.id} leave={schedule.leaves} />
                  <DateExceptionsPanel doctorId={doctor.id} exceptions={schedule.dateExceptions} />
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

          {tab === 'Reviews' && doctor && (
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
                    {doctor.ratingAvg === null ? '—' : doctor.ratingAvg.toFixed(1)}
                  </div>
                  <Stars r={doctor.ratingAvg ?? 0} />
                </div>
                <div className="text-body text-text-muted">
                  {doctor.ratingCount === 0
                    ? 'No patient ratings yet'
                    : `Based on ${doctor.ratingCount} patient rating${doctor.ratingCount === 1 ? '' : 's'}`}
                </div>
              </Card>
              <EmptyState
                compact
                icon="message-circle"
                title="Individual reviews aren't shown here"
                message="The hospital app receives each doctor's average rating; the written reviews are moderated by Medibook."
              />
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

  const isLoading =
    departmentsQuery.isPending || (!isNew && (doctorQuery.isPending || scheduleQuery.isPending));
  if (isLoading) return <SkeletonCards count={2} lines={6} />;

  // Keyed by id: a different doctor is a different editor, with its own draft.
  return (
    <DoctorEditor
      key={selId ?? 'new'}
      role={role}
      doctor={doctorQuery.data ?? null}
      schedule={scheduleQuery.data ?? null}
      departments={departmentsQuery.data ?? []}
    />
  );
}
