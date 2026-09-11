import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { hospitalPath, isHospitalRole, type HospitalRole } from '@/app/router/paths';
import {
  HOSPITAL_IDS,
  HOSPITAL_NAMES,
  mkWeek,
} from '@/features/doctors/application/store/catalog.fixtures';
import { useCatalogStore } from '@/features/doctors/application/store/catalog.store';
import type {
  CatalogDoctorStatus,
  Doctor,
  WeekDay,
} from '@/features/doctors/application/store/catalog.types';
import { summariseWeekHours } from '@/features/doctors/domain/schedule';
import { useSettingsStore } from '@/features/settings/application/store/settings.store';
import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { email as validateEmail, phoneIN, positiveAmount, required } from '@/shared/lib/validate';
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
import { Tabs } from '@/shared/ui/Tabs';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import { DateExceptionsPanel } from '../components/DateExceptionsPanel';
import { LeavePanel } from '../components/LeavePanel';
import { PhotoButton } from '../components/PhotoButton';
import { ShiftPatternsPanel } from '../components/ShiftPatternsPanel';
import { Stars } from '../components/Stars';
import { WeeklyHours } from '../components/WeeklyHours';

/** Doctor statuses offered in the profile controls (design order). */
const STATUS_OPTIONS = ['Active', 'On Leave', 'Inactive'] as const;

/** Editable draft — `fee` is digits-only text until parsed on save. */
interface DoctorForm {
  name: string;
  depts: readonly string[];
  spec: string;
  room: string;
  phone: string;
  email: string;
  qual: string;
  exp: string;
  reg: string;
  fee: string;
  status: CatalogDoctorStatus;
  hospital: string;
  photo: string | null;
  about: string;
  week: readonly WeekDay[];
}

/**
 * Declared at module level so `useForm`'s error memo stays stable.
 *
 * Phone and email are optional on a doctor profile (the seeded roster has
 * neither), so they are only checked once something has been typed — an empty
 * optional field is not an error, a malformed one is.
 */
const DOCTOR_VALIDATORS: FormValidators<DoctorForm> = {
  name: (v) => required(v, 'Doctor name'),
  fee: (v) => positiveAmount(v, 'Consultation fee'),
  phone: (v) => (v.trim() === '' ? undefined : phoneIN(v)),
  email: (v) => (v.trim() === '' ? undefined : validateEmail(v)),
  depts: (v) => (v.length > 0 ? undefined : 'Assign at least one department.'),
};

/** Keep only digits, so the ₹ prefix the input shows never reaches the value. */
function digits(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

function blankDoctorForm(): DoctorForm {
  return {
    name: '',
    depts: [],
    spec: '',
    room: '',
    phone: '',
    email: '',
    qual: '',
    exp: '',
    reg: '',
    fee: '',
    status: 'Active',
    hospital: HOSPITAL_IDS[0],
    photo: null,
    about: '',
    week: mkWeek([0, 1, 2, 3, 4], '9:00 am', '5:00 pm'),
  };
}

function toForm(d: Doctor): DoctorForm {
  return {
    name: d.name,
    depts: d.depts,
    spec: d.spec,
    room: d.room,
    phone: d.phone ?? '',
    email: d.email ?? '',
    qual: d.qual ?? '',
    exp: d.exp ?? '',
    reg: d.reg ?? '',
    fee: String(d.fee || ''),
    status: d.status,
    hospital: d.hospital,
    photo: d.photo ?? null,
    about: d.about ?? '',
    week: d.week,
  };
}

interface DoctorEditorProps {
  role: HospitalRole;
  /** The stored record, or `null` for `/doctors/new`. */
  doctor: Doctor | null;
}

/**
 * The doctor profile editor. Mounted with a `key` per doctor id, so the draft
 * is initialised **once** per doctor instead of being re-seeded from the store
 * by an effect — which is what used to throw away weekly-hours edits the
 * moment anything else in the catalog changed (audit 3.1.6).
 */
function DoctorEditor({ role, doctor }: DoctorEditorProps) {
  const navigate = useNavigate();
  const isNew = doctor === null;
  const depts = useCatalogStore((s) => s.depts);
  const patterns = useCatalogStore((s) => s.patterns);
  const catSaveDoctor = useCatalogStore((s) => s.catSaveDoctor);
  const catPatchDoctor = useCatalogStore((s) => s.catPatchDoctor);
  const catDeleteDoctor = useCatalogStore((s) => s.catDeleteDoctor);
  const rules = useSettingsStore((s) => s.settings.rules);
  const [tab, setTab] = useState('Profile');
  const [confirmDelete, setConfirmDelete] = useState(false);

  /**
   * Leave and date exceptions are committed by their own panels the moment
   * they are edited, so they are read **live** from the store rather than
   * copied into the draft — the two can never disagree.
   */
  const liveLeave = useCatalogStore((s) => s.docs.find((d) => d.id === doctor?.id)?.leave);
  const liveExceptions = useCatalogStore(
    (s) => s.docs.find((d) => d.id === doctor?.id)?.exceptions,
  );

  const back = (): void => {
    void navigate(hospitalPath(role, 'doctors'));
  };

  const form = useForm<DoctorForm>({
    initial: doctor ? toForm(doctor) : blankDoctorForm(),
    validate: DOCTOR_VALIDATORS,
    onSubmit: (values) => {
      const patch = {
        name: values.name.trim(),
        depts: values.depts,
        spec: values.spec.trim(),
        room: values.room.trim(),
        phone: values.phone.trim(),
        email: values.email.trim(),
        qual: values.qual.trim(),
        exp: values.exp.trim(),
        reg: values.reg.trim(),
        fee: Number(digits(values.fee)) || 0,
        status: values.status,
        hospital: values.hospital,
        photo: values.photo,
        about: values.about.trim(),
        week: values.week,
      };
      if (doctor) {
        // Patch, never replace: leave and exceptions already live in the
        // store and must survive a profile save.
        catPatchDoctor(doctor.id, patch);
      } else {
        catSaveDoctor({ ...patch, rating: 0, reviews: 0, leave: [], exceptions: [], list: [] });
      }
      toast(isNew ? 'Doctor added' : 'Doctor profile saved', 'success');
      back();
    },
  });

  const values = form.values;
  const toggleDept = (name: string): void =>
    form.setField(
      'depts',
      values.depts.includes(name)
        ? values.depts.filter((n) => n !== name)
        : [...values.depts, name],
    );

  const del = (): void => {
    if (doctor) catDeleteDoctor(doctor.id);
    toast('Doctor profile deleted', 'info');
    setConfirmDelete(false);
    back();
  };

  const deptNames = depts.map((x) => x.name);
  const statusCaption =
    values.status === 'Inactive'
      ? 'Disabled — hidden from the patient app'
      : values.status === 'On Leave'
        ? 'Visible, booking paused'
        : 'Live & bookable in the app';
  const deptError = form.errorFor('depts');
  const weekSummary = summariseWeekHours(values.week);

  return (
    <div className="flex max-w-260 flex-col gap-5">
      <Card pad={22} className="flex flex-wrap items-center gap-4.5">
        <Avatar name={values.name || '?'} src={values.photo ?? undefined} size={64} />
        <div className="min-w-55 flex-1">
          <div className="flex items-center gap-2.5">
            <span className="text-h1 text-text-strong">
              {values.name || (isNew ? 'New Doctor Profile' : 'Doctor')}
            </span>
            <Badge status={values.status} />
          </div>
          <div className="text-body text-text-muted mt-1.25 flex flex-wrap items-center gap-3">
            {values.spec && <span>{values.spec}</span>}
            {values.depts.length > 0 && (
              <span>
                {values.spec ? '· ' : ''}
                {values.depts.join(', ')}
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
                  {doctor.rating} ({doctor.reviews})
                </span>
              </span>
            )}
            <span>· {HOSPITAL_NAMES[values.hospital] ?? values.hospital}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="text-caption text-text-muted">Profile status</span>
          <SegTabs
            tabs={STATUS_OPTIONS}
            value={values.status}
            onChange={(v) => form.setField('status', v as CatalogDoctorStatus)}
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
                <Avatar name={values.name || '?'} src={values.photo ?? undefined} size={56} />
                <PhotoButton
                  onPick={(url) => form.setField('photo', url)}
                  label={values.photo ? 'Change Photo' : 'Upload Photo'}
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
                <Field label="Specialization">
                  <TextInput
                    value={values.spec}
                    placeholder="e.g. Cardiologist"
                    onChange={(v) => form.setField('spec', v)}
                  />
                </Field>
                <Field label="Room Number">
                  <TextInput
                    value={values.room}
                    placeholder="e.g. 101"
                    onChange={(v) => form.setField('room', v)}
                  />
                </Field>
                <Field label="Phone Number" error={form.errorFor('phone')}>
                  <TextInput
                    value={values.phone}
                    placeholder="Mobile"
                    inputMode="tel"
                    autoComplete="tel"
                    onChange={(v) => form.setField('phone', v)}
                    onBlur={() => form.blurField('phone')}
                  />
                </Field>
                <Field label="Email" error={form.errorFor('email')}>
                  <TextInput
                    value={values.email}
                    placeholder="name@hospital.med"
                    type="email"
                    autoComplete="email"
                    onChange={(v) => form.setField('email', v)}
                    onBlur={() => form.blurField('email')}
                  />
                </Field>
                <Field label="Qualification">
                  <TextInput
                    value={values.qual}
                    placeholder="MBBS, MD"
                    onChange={(v) => form.setField('qual', v)}
                  />
                </Field>
                <Field label="Experience (years)">
                  <TextInput
                    value={values.exp}
                    placeholder="e.g. 12"
                    inputMode="numeric"
                    onChange={(v) => form.setField('exp', v)}
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
                    options={STATUS_OPTIONS}
                    onChange={(v) => form.setField('status', v as CatalogDoctorStatus)}
                  />
                </Field>
                <Field label="Hospital">
                  <Select
                    value={HOSPITAL_NAMES[values.hospital] ?? ''}
                    options={HOSPITAL_IDS.map((id) => HOSPITAL_NAMES[id])}
                    onChange={(name) =>
                      form.setField(
                        'hospital',
                        HOSPITAL_IDS.find((id) => HOSPITAL_NAMES[id] === name) ?? values.hospital,
                      )
                    }
                  />
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
                    <InfoDot text="Overrides the department's base fee. This is what patients pay & see in the app." />
                  </div>
                </Field>
              </div>
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-label font-ui text-text-strong">Departments</span>
                  <span className="text-d-500">*</span>
                  <InfoDot text="A doctor can belong to more than one department." />
                </div>
                <div className="flex flex-wrap gap-2">
                  {deptNames.map((name) => {
                    const on = values.depts.includes(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleDept(name)}
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
                    <span className="text-body text-text-strong font-medium">{rules.duration}</span>
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
                value={values.week}
                onChange={(week) => form.setField('week', week)}
                patterns={patterns}
                info="The Medibook app only offers booking slots during these hours. Outside them, patients can't book."
              />
              <div className="text-caption text-text-muted flex items-center gap-1.5">
                <Icon name="clock" size={13} /> {weekSummary} · unsaved changes apply when you press{' '}
                {isNew ? 'Add Doctor' : 'Save Changes'}
              </div>
              <ShiftPatternsPanel />
              {doctor ? (
                <>
                  <LeavePanel doctorId={doctor.id} leave={liveLeave ?? doctor.leave} />
                  <DateExceptionsPanel
                    doctorId={doctor.id}
                    exceptions={liveExceptions ?? doctor.exceptions}
                  />
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
                  Reviews come from patients in the Medibook app and are read-only.
                </span>
                <InfoDot text="You can't edit or delete patient reviews. Report abuse to Medibook support." />
              </div>
              <Card pad={16} className="mb-3.5 flex items-center gap-4">
                <div className="text-center">
                  <div className="text-text-strong text-h1 font-bold">{doctor.rating}</div>
                  <Stars r={doctor.rating} />
                </div>
                <div className="text-body text-text-muted">
                  Based on {doctor.reviews} patient reviews
                </div>
              </Card>
              {doctor.list.length === 0 ? (
                <EmptyState
                  compact
                  icon="message-circle"
                  title="No reviews yet"
                  message="Reviews appear here once patients rate this doctor in the Medibook app."
                />
              ) : (
                <div className="flex flex-col gap-2.5">
                  {doctor.list.map((rv, i) => (
                    <div
                      key={`${rv.a}-${i}`}
                      className="border-border-soft rounded-md border p-3.5"
                    >
                      <div className="mb-1.5 flex items-center gap-2.5">
                        <Avatar name={rv.a} size={28} />
                        <span className="text-body text-text-strong font-medium">{rv.a}</span>
                        <span className="flex-1" />
                        <Stars r={rv.r} size={13} />
                      </div>
                      <div className="text-body text-text-body">{rv.t}</div>
                      <div className="text-caption text-text-muted mt-1.5">{rv.d}</div>
                    </div>
                  ))}
                </div>
              )}
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
          <Button icon="check" busy={form.submitting} onClick={form.handleSubmit}>
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
    </div>
  );
}

/** Doctor profile detail / editor (design `DoctorDetailPage`; `:id === 'new'` is blank). */
export function DoctorDetailPageScreen() {
  const { id: selId, role: roleParam } = useParams();
  const navigate = useNavigate();
  const role = isHospitalRole(roleParam) ? roleParam : 'admin';
  const isNew = !selId || selId === 'new';
  const doctor = useCatalogStore((s) => s.docs.find((x) => x.id === selId));

  if (!isNew && !doctor) {
    return (
      <ErrorState
        icon="user-x"
        title="Doctor not found"
        message="This profile is no longer in the catalogue — it may have been deleted on another screen."
        onRetry={() => navigate(hospitalPath(role, 'doctors'))}
        retryLabel="Back to Doctors & Departments"
      />
    );
  }

  // Keyed by id: a different doctor is a different editor, with its own draft.
  return <DoctorEditor key={selId ?? 'new'} role={role} doctor={doctor ?? null} />;
}
