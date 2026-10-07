import { idempotencyKey, ifMatch } from '@/core/api/headers';
import { hospitalApi } from '@/core/api/http';
import { MAX_PAGE_SIZE, paginatedSchema } from '@/core/api/pagination';

import type {
  DateExceptionInput,
  DepartmentInput,
  DoctorFilters,
  DoctorInput,
  LeaveInput,
  WeeklySession,
} from '@/features/doctors/domain/entities/doctors.types';
import type {
  DepartmentResponse,
  DoctorResponse,
  ScheduleChangeResponse,
  ScheduleResponse,
} from '@/features/doctors/infrastructure/data-sources/remote/doctors.response';
import {
  departmentResponseSchema,
  doctorResponseSchema,
  PAISE_PER_RUPEE,
  scheduleChangeResponseSchema,
  scheduleResponseSchema,
} from '@/features/doctors/infrastructure/data-sources/remote/doctors.response';

/**
 * Doctors & Departments endpoints (`/api/v1/hospital/…`). Lists are
 * paginated server-side (despite `schema.yml` typing them as arrays); the
 * catalogue is small, so every page is fetched. Writes that can cancel
 * bookings carry a fresh `Idempotency-Key` per call and `?confirm=`.
 */

export const departmentPageSchema = paginatedSchema(departmentResponseSchema);
export const doctorPageSchema = paginatedSchema(doctorResponseSchema);

/** Non-alphanumeric runs collapse to one dash. */
const SLUG_SEPARATOR_PATTERN = /[^a-z0-9]+/g;
const SLUG_TRIM_PATTERN = /^-+|-+$/g;

/** A URL-safe key from a display name ("Dr. Asha Verma" → "dr-asha-verma"). */
function slugify(value: string): string {
  return value.toLowerCase().replace(SLUG_SEPARATOR_PATTERN, '-').replace(SLUG_TRIM_PATTERN, '');
}

function confirmParams(confirm: boolean) {
  return { confirm };
}

/** Fetch every page of a list, in order. */
async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<{ results: T[]; has_next: boolean }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; ; page += 1) {
    const data = await fetchPage(page);
    rows.push(...data.results);
    if (!data.has_next) return rows;
  }
}

/* ---------------------------------------------------------------- departments */

export function getDepartments(): Promise<DepartmentResponse[]> {
  return fetchAllPages(async (page) => {
    const response = await hospitalApi.get('/departments', {
      params: { page, page_size: MAX_PAGE_SIZE },
    });
    return departmentPageSchema.parse(response.data);
  });
}

function departmentBody(input: DepartmentInput) {
  return {
    name: input.name,
    description: input.description || null,
    is_active: input.isActive,
  };
}

export async function postDepartment(input: DepartmentInput): Promise<DepartmentResponse> {
  const response = await hospitalApi.post('/departments', {
    ...departmentBody(input),
    code: slugify(input.name),
  });
  return departmentResponseSchema.parse(response.data);
}

/** `If-Match` is mandatory here: without it every edit is refused (DATA-05). */
export async function patchDepartment(
  id: string,
  input: DepartmentInput,
  version: number,
): Promise<DepartmentResponse> {
  const response = await hospitalApi.patch(
    `/departments/${encodeURIComponent(id)}`,
    departmentBody(input),
    { headers: ifMatch(version) },
  );
  return departmentResponseSchema.parse(response.data);
}

export async function deleteDepartment(id: string): Promise<void> {
  await hospitalApi.delete(`/departments/${encodeURIComponent(id)}`);
}

/* -------------------------------------------------------------------- doctors */

export function getDoctors(filters: DoctorFilters): Promise<DoctorResponse[]> {
  return fetchAllPages(async (page) => {
    const response = await hospitalApi.get('/doctors', {
      params: {
        page,
        page_size: MAX_PAGE_SIZE,
        search: filters.search || undefined,
        department_id: filters.departmentId,
        status: filters.status,
      },
    });
    return doctorPageSchema.parse(response.data);
  });
}

export async function getDoctor(id: string): Promise<DoctorResponse> {
  const response = await hospitalApi.get(`/doctors/${encodeURIComponent(id)}`);
  return doctorResponseSchema.parse(response.data);
}

function doctorBody(input: DoctorInput) {
  return {
    name: input.name,
    department_id: input.departmentId,
    specialisation: input.specialisation,
    qualification: input.qualification || null,
    registration_no: input.registrationNo || null,
    experience_years: input.experienceYears,
    bio: input.bio || null,
    room: input.room || null,
    consultation_fee_paise: Math.round(input.feeRupees * PAISE_PER_RUPEE),
    follow_up_fee_paise:
      input.followUpFeeRupees === null
        ? null
        : Math.round(input.followUpFeeRupees * PAISE_PER_RUPEE),
    is_bookable_online: input.isBookableOnline,
    status: input.status,
    photo_file_id: input.photoFileId,
  };
}

export async function postDoctor(input: DoctorInput): Promise<DoctorResponse> {
  const response = await hospitalApi.post('/doctors', {
    ...doctorBody(input),
    slug: slugify(input.name),
  });
  return doctorResponseSchema.parse(response.data);
}

export async function patchDoctor(
  id: string,
  input: DoctorInput,
  version: number,
  confirm: boolean,
): Promise<ScheduleChangeResponse> {
  const response = await hospitalApi.patch(
    `/doctors/${encodeURIComponent(id)}`,
    doctorBody(input),
    {
      params: confirmParams(confirm),
      headers: { ...ifMatch(version), ...idempotencyKey() },
    },
  );
  return scheduleChangeResponseSchema.parse(response.data);
}

export async function deleteDoctor(id: string, confirm: boolean): Promise<ScheduleChangeResponse> {
  const response = await hospitalApi.delete(`/doctors/${encodeURIComponent(id)}`, {
    params: confirmParams(confirm),
    headers: idempotencyKey(),
  });
  return scheduleChangeResponseSchema.parse(response.data);
}

/* ------------------------------------------------------------------- schedule */

export async function getSchedule(doctorId: string): Promise<ScheduleResponse> {
  const response = await hospitalApi.get(`/doctors/${encodeURIComponent(doctorId)}/schedule`);
  return scheduleResponseSchema.parse(response.data);
}

export async function putWeeklySessions(
  doctorId: string,
  sessions: readonly WeeklySession[],
  version: number,
  confirm: boolean,
): Promise<ScheduleChangeResponse> {
  const response = await hospitalApi.put(
    `/doctors/${encodeURIComponent(doctorId)}/weekly-sessions`,
    {
      sessions: sessions.map((s) => ({
        weekday: s.weekday,
        session_code: s.sessionCode,
        label: s.label,
        starts_at: s.startsAt,
        ends_at: s.endsAt,
        is_active: true,
      })),
    },
    { params: confirmParams(confirm), headers: { ...ifMatch(version), ...idempotencyKey() } },
  );
  return scheduleChangeResponseSchema.parse(response.data);
}

function leaveBody(input: LeaveInput) {
  return {
    leave_type: input.kind,
    date_from: input.dateFrom,
    date_to: input.dateTo,
    reason: input.reason || null,
  };
}

export async function postLeave(
  doctorId: string,
  input: LeaveInput,
  confirm: boolean,
): Promise<ScheduleChangeResponse> {
  const response = await hospitalApi.post(
    `/doctors/${encodeURIComponent(doctorId)}/leaves`,
    leaveBody(input),
    {
      params: confirmParams(confirm),
      headers: idempotencyKey(),
    },
  );
  return scheduleChangeResponseSchema.parse(response.data);
}

export async function patchLeave(
  doctorId: string,
  leaveId: string,
  input: LeaveInput,
  version: number,
  confirm: boolean,
): Promise<ScheduleChangeResponse> {
  const response = await hospitalApi.patch(
    `/doctors/${encodeURIComponent(doctorId)}/leaves/${encodeURIComponent(leaveId)}`,
    leaveBody(input),
    { params: confirmParams(confirm), headers: { ...ifMatch(version), ...idempotencyKey() } },
  );
  return scheduleChangeResponseSchema.parse(response.data);
}

export async function deleteLeave(
  doctorId: string,
  leaveId: string,
  confirm: boolean,
  version: number,
): Promise<ScheduleChangeResponse> {
  const response = await hospitalApi.delete(
    `/doctors/${encodeURIComponent(doctorId)}/leaves/${encodeURIComponent(leaveId)}`,
    {
      params: confirmParams(confirm),
      headers: { ...ifMatch(version), ...idempotencyKey() },
    },
  );
  return scheduleChangeResponseSchema.parse(response.data);
}

function exceptionBody(input: DateExceptionInput) {
  return {
    date: input.date,
    kind: input.kind,
    note: input.note || null,
    sessions:
      input.kind === 'closed'
        ? []
        : input.sessions.map((s) => ({
            session_code: s.sessionCode,
            label: s.label,
            starts_at: s.startsAt,
            ends_at: s.endsAt,
          })),
  };
}

export async function postDateException(
  doctorId: string,
  input: DateExceptionInput,
  confirm: boolean,
): Promise<ScheduleChangeResponse> {
  const response = await hospitalApi.post(
    `/doctors/${encodeURIComponent(doctorId)}/date-exceptions`,
    exceptionBody(input),
    { params: confirmParams(confirm), headers: idempotencyKey() },
  );
  return scheduleChangeResponseSchema.parse(response.data);
}

export async function patchDateException(
  doctorId: string,
  exceptionId: string,
  input: DateExceptionInput,
  version: number,
  confirm: boolean,
): Promise<ScheduleChangeResponse> {
  const response = await hospitalApi.patch(
    `/doctors/${encodeURIComponent(doctorId)}/date-exceptions/${encodeURIComponent(exceptionId)}`,
    exceptionBody(input),
    { params: confirmParams(confirm), headers: { ...ifMatch(version), ...idempotencyKey() } },
  );
  return scheduleChangeResponseSchema.parse(response.data);
}

export async function deleteDateException(
  doctorId: string,
  exceptionId: string,
  confirm: boolean,
  version: number,
): Promise<ScheduleChangeResponse> {
  const response = await hospitalApi.delete(
    `/doctors/${encodeURIComponent(doctorId)}/date-exceptions/${encodeURIComponent(exceptionId)}`,
    {
      params: confirmParams(confirm),
      headers: { ...ifMatch(version), ...idempotencyKey() },
    },
  );
  return scheduleChangeResponseSchema.parse(response.data);
}
