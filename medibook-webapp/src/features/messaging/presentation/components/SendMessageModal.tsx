import { useState } from 'react';

import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { fmtDate, todayISO } from '@/shared/lib/format';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';

import { useMessagingTemplatesQuery } from '@/features/messaging/application/queries/useMessagingTemplatesQuery';
import { renderTemplate } from '@/features/messaging/application/store/messaging.logic';
import {
  PATIENT_CHANNELS,
  type ManualEventCode,
  type PatientChannel,
} from '@/features/messaging/domain/entities/messaging.entities';
import { MessagePreview } from '@/features/messaging/presentation/components/MessagePreview';
import {
  DESK_SEND_EVENTS,
  channelLabel,
  eventLabel,
  fmtLocalTime,
  messagingSampleValues,
  patientChannelFromLabel,
} from '@/features/messaging/presentation/components/messaging.labels';
import { usePatientAppointmentsQuery } from '@/features/patients/application/queries/usePatientAppointmentsQuery';
import { usePatientsQuery } from '@/features/patients/application/queries/usePatientsQuery';
import type {
  AppointmentStatus,
  PatientAppointment,
  PatientListParams,
  PatientRecord,
} from '@/features/patients/domain/entities/patients.entities';

/** How many patients the picker offers per search. */
const PATIENT_PICK_LIMIT = 20;

/** Searches shorter than this list the first patients alphabetically instead. */
const MIN_SEARCH_CHARS = 2;

/** Appointments still worth confirming or reminding about. */
const MESSAGEABLE_STATUSES: ReadonlySet<AppointmentStatus> = new Set([
  'pending_approval',
  'scheduled',
  'checked_in',
]);

/** What the screen needs to confirm, then queue, one send. */
export interface SendReview {
  readonly appointmentId: string;
  readonly eventCode: ManualEventCode;
  readonly channel: PatientChannel;
  readonly patientName: string;
  /** Where it goes — a phone number, or the patient's app for push. */
  readonly destination: string;
  readonly bookingRef: string;
}

interface SendForm {
  patientId: string;
  appointmentId: string;
  eventCode: ManualEventCode;
  channel: PatientChannel;
}

const VALIDATORS: FormValidators<SendForm> = {
  patientId: (v) => (v === '' ? 'Pick the patient to message.' : undefined),
  appointmentId: (v) => (v === '' ? 'Pick the appointment this message is about.' : undefined),
};

interface SendMessageModalProps {
  open: boolean;
  onClose: () => void;
  /** Hands the chosen send up; the screen confirms before queueing. */
  onReview: (review: SendReview) => void;
}

function patientLabel(p: PatientRecord): string {
  return `${p.fullName} · ${p.mrn}${p.phone ? ` · ${p.phone}` : ''}`;
}

function appointmentLabel(a: PatientAppointment): string {
  return `${a.bookingRef} · ${a.doctorName} · ${fmtDate(a.scheduledDate)} ${fmtLocalTime(a.scheduledStartAt)}`;
}

/** Upcoming, still-active appointments, soonest first. */
function messageable(items: readonly PatientAppointment[]): readonly PatientAppointment[] {
  const today = todayISO();
  return items
    .filter((a) => MESSAGEABLE_STATUSES.has(a.status) && a.scheduledDate >= today)
    .toSorted((a, b) => a.scheduledStartAt.localeCompare(b.scheduledStartAt));
}

function destinationFor(channel: PatientChannel, patient: PatientRecord): string {
  if (channel === 'push') return "the patient's Medibook app";
  return patient.phone ?? 'no phone on record';
}

/**
 * Trigger a confirmation or reminder for one appointment (audit HA-12),
 * through `POST /hospital/messaging/send`.
 *
 * Two-step picker on the patients API (H6): find the patient, then choose one
 * of their upcoming appointments. The preview is the platform template filled
 * with this appointment's values; the server renders the real message.
 * Nothing is queued from inside this modal — the screen confirms first.
 */
export function SendMessageModal({ open, onClose, onReview }: SendMessageModalProps) {
  const [search, setSearch] = useState('');
  const term = search.trim();
  const params: PatientListParams = {
    page: 1,
    pageSize: PATIENT_PICK_LIMIT,
    q: term.length >= MIN_SEARCH_CHARS ? term : '',
    source: null,
    sortField: 'full_name',
    sortDirection: 'asc',
  };
  const patientsQuery = usePatientsQuery(params);
  const patients = patientsQuery.data?.items ?? [];

  const form = useForm<SendForm>({
    initial: {
      patientId: '',
      appointmentId: '',
      eventCode: 'appointment.reminder',
      channel: 'sms',
    },
    validate: VALIDATORS,
    onSubmit: (v) => {
      if (!appt || !patient) return;
      onReview({
        appointmentId: appt.id,
        eventCode: v.eventCode,
        channel: v.channel,
        patientName: patient.fullName,
        destination: destinationFor(v.channel, patient),
        bookingRef: appt.bookingRef,
      });
    },
  });
  const { values } = form;

  const patient = patients.find((p) => p.id === values.patientId) ?? null;
  const appointmentsQuery = usePatientAppointmentsQuery(values.patientId || undefined);
  const appointments = messageable(appointmentsQuery.data?.items ?? []);
  const appt = appointments.find((a) => a.id === values.appointmentId) ?? null;

  const templatesQuery = useMessagingTemplatesQuery(values.channel);
  const template = templatesQuery.data?.find((t) => t.eventCode === values.eventCode) ?? null;

  const rendered =
    template && appt && patient
      ? renderTemplate(template.body, {
          ...messagingSampleValues(),
          '{{patientName}}': patient.fullName,
          '{{name}}': patient.firstName,
          '{{doctorName}}': appt.doctorName,
          '{{date}}': fmtDate(appt.scheduledDate),
          '{{time}}': fmtLocalTime(appt.scheduledStartAt),
          '{{token}}': appt.tokenLabel ?? '—',
          '{{bookingRef}}': appt.bookingRef,
        })
      : '';

  const patientPlaceholder = patientsQuery.isLoading
    ? 'Loading patients…'
    : patientsQuery.isError
      ? 'Patients could not be loaded — close and try again'
      : patients.length === 0
        ? 'No patients match this search'
        : 'Pick a patient';

  const appointmentPlaceholder = !patient
    ? 'Pick a patient first'
    : appointmentsQuery.isLoading
      ? 'Loading appointments…'
      : appointmentsQuery.isError
        ? 'Appointments could not be loaded — pick the patient again'
        : appointments.length === 0
          ? 'No upcoming appointments for this patient'
          : 'Pick an appointment';

  const channelName = channelLabel(values.channel);
  const noTemplate = templatesQuery.isSuccess && template == null;

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="Send a message"
      width={680}
      onSubmit={form.handleSubmit}
      submitLabel="Review & queue"
      disabled={template == null || appt == null}
      busy={form.submitting}
    >
      <div className="flex flex-col gap-4">
        <Field label="Find patient" hint="Name, phone or MRN.">
          <TextInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              form.setValues({ patientId: '', appointmentId: '' });
            }}
            placeholder="e.g. Ellen or 98765 43210"
            icon="search"
            inputMode="search"
            height={48}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Patient" required error={form.errorFor('patientId')}>
            <Select
              value={patient ? patientLabel(patient) : ''}
              options={patients.map(patientLabel)}
              onChange={(label) => {
                const picked = patients.find((p) => patientLabel(p) === label);
                form.setValues({ patientId: picked?.id ?? '', appointmentId: '' });
              }}
              placeholder={patientPlaceholder}
              disabled={patients.length === 0}
              height={48}
            />
          </Field>
          <Field label="Appointment" required error={form.errorFor('appointmentId')}>
            <Select
              value={appt ? appointmentLabel(appt) : ''}
              options={appointments.map(appointmentLabel)}
              onChange={(label) => {
                const picked = appointments.find((a) => appointmentLabel(a) === label);
                form.setField('appointmentId', picked?.id ?? '');
              }}
              placeholder={appointmentPlaceholder}
              disabled={appointments.length === 0}
              height={48}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Message">
            <Select
              value={eventLabel(values.eventCode)}
              options={DESK_SEND_EVENTS.map(eventLabel)}
              onChange={(label) => {
                const code = DESK_SEND_EVENTS.find((e) => eventLabel(e) === label);
                if (code) form.setField('eventCode', code);
              }}
              height={48}
            />
          </Field>
          <Field
            label="Channel"
            hint={patient ? `Goes to ${destinationFor(values.channel, patient)}` : undefined}
          >
            <Select
              value={channelName}
              options={PATIENT_CHANNELS.map(channelLabel)}
              onChange={(label) => {
                const channel = patientChannelFromLabel(label);
                if (channel) form.setField('channel', channel);
              }}
              height={48}
            />
          </Field>
        </div>

        {templatesQuery.isError ? (
          <div className="text-body text-y-800 bg-y-100 flex items-start gap-2 rounded-md px-3.5 py-3">
            <Icon name="triangle-alert" size={16} className="mt-0.5 flex-none" />
            <span>
              The {channelName} templates did not load, so this message cannot be previewed. Close
              and try again.
            </span>
          </div>
        ) : noTemplate ? (
          <div className="text-body text-y-800 bg-y-100 flex items-start gap-2 rounded-md px-3.5 py-3">
            <Icon name="triangle-alert" size={16} className="mt-0.5 flex-none" />
            <span>
              Medibook has no {eventLabel(values.eventCode).toLowerCase()} template for{' '}
              {channelName}. Pick another channel.
            </span>
          </div>
        ) : (
          <MessagePreview
            channel={channelName}
            subject={template?.subject ?? undefined}
            rendered={templatesQuery.isLoading ? 'Loading the template…' : rendered}
            title="This patient will receive"
          />
        )}

        <div className="text-caption text-text-muted flex items-start gap-2">
          <Icon name="info" size={14} className="mt-0.5 flex-none" />
          <span>
            Messages are queued for the gateway, not delivered from this screen — the outbox shows
            each one&apos;s status as the gateway works through it.
          </span>
        </div>
      </div>
    </FormModal>
  );
}
